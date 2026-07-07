import { sendGmailMessage } from "./_shared/gmail.js";

const PDF_ASSET_PATH = "/assets/free-sample-pack.pdf";
const CUSTOMER_SUBJECT = "Your Little Pause Pages free sample pack";
const ADMIN_EMAIL = "little.pause.pages@gmail.com";
const ADMIN_SUBJECT = "Little Pause Pages free sample sent";
const THANK_YOU_PATH = "/free-samples-thanks.html";

function getOptionalEnv(name) {
    return Netlify.env.get(name) || "";
}

function clean(value) {
    return String(value ?? "").trim();
}

function redirect(location) {
    return new Response(null, {
        status: 303,
        headers: {
            Location: location,
        },
    });
}

function errorResponse(message, status = 400) {
    return new Response(message, {
        status,
        headers: {
            "Content-Type": "text/plain; charset=utf-8",
        },
    });
}

function emailIsValid(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function buildCustomerEmail({ name, note }) {
    const greetingName = name || "there";
    return [
        `Hi ${greetingName},`,
        "",
        "Thanks for requesting the Little Pause Pages free sample pack.",
        "The printable PDF is attached to this email, so you can print it right away.",
        "",
        "If you need anything else, just reply to this message.",
        "",
        note ? `Your note: ${note}` : "",
        "Little Pause Pages",
    ]
        .filter(Boolean)
        .join("\n");
}

function buildAdminEmail({ name, email, note }) {
    return [
        "A free sample PDF was sent immediately.",
        "",
        `Name: ${name || "(not provided)"}`,
        `Email: ${email}`,
        note ? `Note: ${note}` : "",
        `Sent at: ${new Date().toISOString()}`,
    ]
        .filter(Boolean)
        .join("\n");
}

async function fetchPdfBuffer(siteUrl) {
    const baseUrl =
        siteUrl ||
        getOptionalEnv("URL") ||
        getOptionalEnv("DEPLOY_PRIME_URL") ||
        "https://little-pause-pages.netlify.app";
    const pdfUrl = getOptionalEnv("SAMPLE_PACK_PDF_URL") || new URL(PDF_ASSET_PATH, baseUrl).toString();
    const response = await fetch(pdfUrl);

    if (!response.ok) {
        throw new Error(`Unable to fetch sample PDF (${response.status})`);
    }

    return Buffer.from(await response.arrayBuffer());
}

async function parseForm(request) {
    const contentType = request.headers.get("content-type") || "";

    if (contentType.includes("application/x-www-form-urlencoded") || contentType.includes("multipart/form-data")) {
        const formData = await request.formData();
        return {
            botField: clean(formData.get("bot-field")),
            name: clean(formData.get("name")),
            email: clean(formData.get("email")),
            note: clean(formData.get("message") || formData.get("note")),
        };
    }

    if (contentType.includes("application/json")) {
        const payload = await request.json();
        return {
            botField: clean(payload["bot-field"]),
            name: clean(payload.name),
            email: clean(payload.email),
            note: clean(payload.message || payload.note),
        };
    }

    return {
        botField: "",
        name: "",
        email: "",
        note: "",
    };
}

export default async function handler(request, context) {
    if (request.method !== "POST") {
        return errorResponse("Method not allowed.", 405);
    }

    try {
        const form = await parseForm(request);

        if (form.botField) {
            return redirect(THANK_YOU_PATH);
        }

        if (!emailIsValid(form.email)) {
            return errorResponse("Please enter a valid email address.");
        }

        const pdfBuffer = await fetchPdfBuffer(context?.site?.url || "");
        const senderEmail = getOptionalEnv("GMAIL_SENDER_EMAIL") || undefined;

        await sendGmailMessage({
            from: senderEmail,
            to: form.email,
            subject: CUSTOMER_SUBJECT,
            text: buildCustomerEmail(form),
            attachment: {
                filename: "Little Pause Pages Free Sample Pack.pdf",
                mimeType: "application/pdf",
                data: pdfBuffer,
            },
        });

        await sendGmailMessage({
            from: senderEmail,
            to: ADMIN_EMAIL,
            subject: ADMIN_SUBJECT,
            text: buildAdminEmail(form),
        });

        return redirect(THANK_YOU_PATH);
    } catch (error) {
        console.error("Immediate free sample delivery failed:", error);
        return errorResponse("We could not send the sample PDF right now. Please try again later.", 500);
    }
}
