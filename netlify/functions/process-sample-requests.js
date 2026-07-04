import { getStore } from "@netlify/blobs";
import {
    extractMessageText,
    getMessage,
    listUnreadRequestMessages,
    markMessageRead,
    parseRequestDetails,
    sendGmailMessage,
} from "./_shared/gmail.js";
import { listNetlifySampleRequests } from "./_shared/netlify.js";

const REQUEST_FORM_NAME = "free-sample-request";
const REQUEST_EMAIL_SUBJECT = "Little Pause Pages free sample request";
const CUSTOMER_SUBJECT = "Your Little Pause Pages free sample pack";
const ADMIN_NOTIFICATION_SUBJECT = "Little Pause Pages sample request processed";
const ADMIN_EMAIL = "little.pause.pages@gmail.com";
const PDF_ASSET_PATH = "/assets/free-sample-pack.pdf";
const PROCESSED_STORE = getStore({
    name: "little-pause-pages-sample-deliveries",
    consistency: "strong",
});

function requiredEnv(name) {
    const value = Netlify.env.get(name);
    if (!value) {
        throw new Error(`Missing required environment variable: ${name}`);
    }
    return value;
}

function normalizeText(value) {
    return String(value ?? "").trim();
}

function buildCustomerEmail({ requesterName, text }) {
    const greetingName = requesterName || "there";
    return [
        `Hi ${greetingName},`,
        "",
        "Thanks for requesting the Little Pause Pages free sample pack.",
        "The PDF is attached to this email, so you can print it right away.",
        "",
        "If you need anything else, just reply to this message.",
        "",
        text ? `Request note: ${text}` : "",
        "Little Pause Pages",
    ]
        .filter(Boolean)
        .join("\n");
}

function buildAdminEmail(request) {
    return [
        "A new free sample request was processed.",
        "",
        `Source: ${request.source}`,
        `Name: ${request.requesterName || "(not provided)"}`,
        `Email: ${request.requesterEmail || "(not provided)"}`,
        `Received: ${request.receivedAt || "(unknown)"}`,
        request.note ? `Note: ${request.note}` : "",
        request.messageId ? `Gmail message ID: ${request.messageId}` : "",
        request.id ? `Submission ID: ${request.id}` : "",
    ]
        .filter(Boolean)
        .join("\n");
}

async function fetchPdfBuffer(siteUrl) {
    const pdfUrl = Netlify.env.get("SAMPLE_PACK_PDF_URL") || new URL(PDF_ASSET_PATH, siteUrl).toString();
    const response = await fetch(pdfUrl);

    if (!response.ok) {
        throw new Error(`Unable to fetch sample PDF (${response.status})`);
    }

    return Buffer.from(await response.arrayBuffer());
}

function isProcessedKey(source, id) {
    return `${source}:${id}`;
}

async function alreadyProcessed(source, id) {
    const stored = await PROCESSED_STORE.get(isProcessedKey(source, id), { type: "json" });
    return Boolean(stored);
}

async function markProcessed(source, id, metadata) {
    await PROCESSED_STORE.setJSON(isProcessedKey(source, id), {
        processedAt: new Date().toISOString(),
        source,
        id,
        ...metadata,
    });
}

async function collectGmailRequests() {
    const query = `in:inbox subject:"${REQUEST_EMAIL_SUBJECT}" newer_than:30d`;
    const messages = await listUnreadRequestMessages(query);
    const requests = [];

    for (const item of messages) {
        if (await alreadyProcessed("gmail", item.id)) {
            continue;
        }

        const message = await getMessage(item.id);
        const combinedText = normalizeText(
            extractMessageText(message.payload, message.snippet || ""),
        );
        const details = parseRequestDetails(combinedText);
        const headers = Object.fromEntries(
            (message.payload?.headers ?? []).map((header) => [header.name.toLowerCase(), header.value]),
        );

        requests.push({
            source: "gmail",
            id: item.id,
            threadId: message.threadId ?? "",
            messageId: headers["message-id"] ?? "",
            receivedAt: headers.date ?? "",
            requesterEmail: details.email,
            requesterName: details.name,
            note: details.note,
        });
    }

    return requests;
}

async function collectNetlifyRequests(siteId) {
    return listNetlifySampleRequests({
        siteId,
        formName: REQUEST_FORM_NAME,
    });
}

export default async function handler(_request, context) {
    const siteId = context.site?.id || Netlify.env.get("NETLIFY_SITE_ID");
    const siteUrl = context.site?.url || Netlify.env.get("SITE_URL") || "";
    const senderEmail = requiredEnv("GMAIL_SENDER_EMAIL");
    const gmailConfigured =
        Netlify.env.get("GMAIL_CLIENT_ID") &&
        Netlify.env.get("GMAIL_CLIENT_SECRET") &&
        Netlify.env.get("GMAIL_REFRESH_TOKEN");

    try {
        if (!siteId) {
            throw new Error("Missing site id for sample processing");
        }

        let requests = [];

        if (gmailConfigured) {
            requests = await collectGmailRequests();
        }

        if (requests.length === 0) {
            requests = await collectNetlifyRequests(siteId);
        }

        if (requests.length === 0) {
            return new Response(
                JSON.stringify({
                    ok: true,
                    processed: 0,
                    message: "No new sample requests found.",
                }),
                {
                    headers: {
                        "Content-Type": "application/json",
                    },
                },
            );
        }

        const pdfBuffer = await fetchPdfBuffer(siteUrl);
        const results = [];

        for (const request of requests) {
            const sourceKey = isProcessedKey(request.source, request.id);
            if (await PROCESSED_STORE.get(sourceKey, { type: "json" })) {
                results.push({ ...request, status: "skipped" });
                continue;
            }

            if (!request.requesterEmail) {
                results.push({
                    ...request,
                    status: "skipped",
                    reason: "Missing requester email",
                });
                continue;
            }

            const customerText = buildCustomerEmail({
                requesterName: request.requesterName,
                text: request.note,
            });

            await sendGmailMessage({
                from: senderEmail,
                to: request.requesterEmail,
                subject: CUSTOMER_SUBJECT,
                text: customerText,
                attachment: {
                    filename: "Little Pause Pages Free Sample Pack.pdf",
                    mimeType: "application/pdf",
                    data: pdfBuffer,
                },
                threadId: request.source === "gmail" ? request.threadId : "",
                inReplyTo: request.source === "gmail" ? request.messageId : "",
                references: request.source === "gmail" ? request.messageId : "",
            });

            if (request.source === "gmail") {
                await markMessageRead(request.id);
            } else {
                await sendGmailMessage({
                    from: senderEmail,
                    to: ADMIN_EMAIL,
                    subject: ADMIN_NOTIFICATION_SUBJECT,
                    text: buildAdminEmail(request),
                });
            }

            await markProcessed(request.source, request.id, {
                requesterEmail: request.requesterEmail,
                requesterName: request.requesterName,
            });

            results.push({
                ...request,
                status: "processed",
            });
        }

        return new Response(
            JSON.stringify({
                ok: true,
                processed: results.filter((item) => item.status === "processed").length,
                skipped: results.filter((item) => item.status === "skipped").length,
                results,
            }),
            {
                headers: {
                    "Content-Type": "application/json",
                },
            },
        );
    } catch (error) {
        console.error("Sample request automation failed:", error);
        return new Response(
            JSON.stringify({
                ok: false,
                error: error instanceof Error ? error.message : String(error),
            }),
            {
                status: 500,
                headers: {
                    "Content-Type": "application/json",
                },
            },
        );
    }
}

export const config = {
    schedule: "@hourly",
};
