const GMAIL_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GMAIL_API_BASE = "https://gmail.googleapis.com/gmail/v1/users/me";

let cachedAccessToken = "";
let cachedAccessTokenExpiresAt = 0;

function getRequiredEnv(name) {
    const value = Netlify.env.get(name);
    if (!value) {
        throw new Error(`Missing required environment variable: ${name}`);
    }
    return value;
}

function decodeBase64Url(value) {
    const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    return Buffer.from(padded, "base64").toString("utf8");
}

function encodeBase64Url(value) {
    return Buffer.from(value)
        .toString("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/g, "");
}

function wrapBase64(value) {
    return value.match(/.{1,76}/g)?.join("\r\n") ?? value;
}

function stripHtml(html) {
    return html
        .replace(/<script[\s\S]*?<\/script>/gi, " ")
        .replace(/<style[\s\S]*?<\/style>/gi, " ")
        .replace(/<\/(p|div|h[1-6]|li)>/gi, "\n")
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<[^>]+>/g, " ")
        .replace(/\n{3,}/g, "\n\n")
        .replace(/[ \t]+\n/g, "\n")
        .trim();
}

function readBodyPart(part) {
    if (!part) {
        return { text: "", html: "" };
    }

    const result = { text: "", html: "" };

    if (part.mimeType === "text/plain" && part.body?.data) {
        result.text = decodeBase64Url(part.body.data);
    }

    if (part.mimeType === "text/html" && part.body?.data) {
        result.html = decodeBase64Url(part.body.data);
    }

    if (Array.isArray(part.parts)) {
        for (const child of part.parts) {
            const childResult = readBodyPart(child);
            result.text ||= childResult.text;
            result.html ||= childResult.html;
            if (result.text && result.html) {
                break;
            }
        }
    }

    if (!result.text && result.html) {
        result.text = stripHtml(result.html);
    }

    return result;
}

export function extractMessageText(payload, snippet = "") {
    const body = readBodyPart(payload);
    return (body.text || body.html || snippet || "").trim();
}

function firstMatch(text, patterns) {
    for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match?.[1]) {
            return match[1].trim();
        }
    }
    return "";
}

export function parseRequestDetails(text) {
    const normalized = text.replace(/\r/g, "");
    const email =
        firstMatch(normalized, [
            /^\s*email\s*:\s*(.+)$/im,
            /^\s*your email\s*:\s*(.+)$/im,
            /^\s*e-mail\s*:\s*(.+)$/im,
        ]) ||
        normalized.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] ||
        "";

    const name =
        firstMatch(normalized, [
            /^\s*name\s*:\s*(.+)$/im,
            /^\s*your name\s*:\s*(.+)$/im,
        ]) || "";

    const note =
        firstMatch(normalized, [
            /^\s*note\s*:\s*([\s\S]+)$/im,
            /^\s*message\s*:\s*([\s\S]+)$/im,
        ]) || "";

    return {
        email,
        name,
        note,
    };
}

async function getAccessToken() {
    const now = Date.now();
    if (cachedAccessToken && cachedAccessTokenExpiresAt - 30_000 > now) {
        return cachedAccessToken;
    }

    const clientId = getRequiredEnv("GMAIL_CLIENT_ID");
    const clientSecret = getRequiredEnv("GMAIL_CLIENT_SECRET");
    const refreshToken = getRequiredEnv("GMAIL_REFRESH_TOKEN");

    const response = await fetch(GMAIL_TOKEN_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
            client_id: clientId,
            client_secret: clientSecret,
            refresh_token: refreshToken,
            grant_type: "refresh_token",
        }),
    });

    if (!response.ok) {
        throw new Error(`Gmail token refresh failed (${response.status})`);
    }

    const data = await response.json();
    cachedAccessToken = data.access_token;
    cachedAccessTokenExpiresAt = now + (data.expires_in ?? 300) * 1000;
    return cachedAccessToken;
}

async function gmailApi(path, options = {}) {
    const accessToken = await getAccessToken();
    const response = await fetch(`${GMAIL_API_BASE}${path}`, {
        method: options.method ?? "GET",
        headers: {
            Authorization: `Bearer ${accessToken}`,
            ...(options.body ? { "Content-Type": "application/json" } : {}),
        },
        body: options.body ? JSON.stringify(options.body) : undefined,
    });

    if (!response.ok) {
        const detail = await response.text();
        throw new Error(`Gmail API request failed (${response.status}): ${detail}`);
    }

    if (response.status === 204) {
        return null;
    }

    return response.json();
}

export async function listUnreadRequestMessages(query) {
    const data = await gmailApi(`/messages?q=${encodeURIComponent(query)}&maxResults=20`);
    return data.messages ?? [];
}

export async function getMessage(messageId) {
    return gmailApi(`/messages/${messageId}?format=full`);
}

export async function markMessageRead(messageId) {
    await gmailApi(`/messages/${messageId}/modify`, {
        method: "POST",
        body: {
            removeLabelIds: ["UNREAD"],
        },
    });
}

function buildAttachmentPart({ filename, mimeType, data }) {
    const base64 = wrapBase64(Buffer.from(data).toString("base64"));

    return [
        `Content-Type: ${mimeType}; name="${filename}"`,
        "Content-Transfer-Encoding: base64",
        `Content-Disposition: attachment; filename="${filename}"`,
        "",
        base64,
    ].join("\r\n");
}

function buildPlainEmail({ from, to, subject, text, attachment, threadId, inReplyTo, references }) {
    const boundary = `lp-${crypto.randomUUID().replace(/-/g, "")}`;
    const headers = [
        `From: ${from}`,
        `To: ${to}`,
        `Subject: ${subject}`,
        "MIME-Version: 1.0",
    ];

    if (inReplyTo) {
        headers.push(`In-Reply-To: ${inReplyTo}`);
    }

    if (references) {
        headers.push(`References: ${references}`);
    }

    if (!attachment) {
        headers.push("Content-Type: text/plain; charset=\"UTF-8\"");
        return {
            raw: encodeBase64Url(`${headers.join("\r\n")}\r\n\r\n${text}`),
            threadId,
        };
    }

    headers.push(`Content-Type: multipart/mixed; boundary="${boundary}"`);

    const sections = [
        `--${boundary}`,
        "Content-Type: text/plain; charset=\"UTF-8\"",
        "Content-Transfer-Encoding: 7bit",
        "",
        text,
        "",
        `--${boundary}`,
        buildAttachmentPart(attachment),
        "",
        `--${boundary}--`,
        "",
    ];

    return {
        raw: encodeBase64Url(`${headers.join("\r\n")}\r\n\r\n${sections.join("\r\n")}`),
        threadId,
    };
}

export async function sendGmailMessage({
    from,
    to,
    subject,
    text,
    attachment,
    threadId,
    inReplyTo,
    references,
}) {
    const payload = buildPlainEmail({
        from,
        to,
        subject,
        text,
        attachment,
        threadId,
        inReplyTo,
        references,
    });

    return gmailApi("/messages/send", {
        method: "POST",
        body: payload,
    });
}
