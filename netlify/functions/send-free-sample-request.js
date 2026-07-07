import { sendGmailMessage } from "./_shared/gmail.js";

const PDF_ASSET_PATH = "/assets/free-sample-pack.pdf";
const CUSTOMER_SUBJECT = "Little Pause Pages Free Sample PDF";
const ADMIN_EMAIL = "little.pause.pages@gmail.com";
const ADMIN_SUBJECT = "Little Pause Pages free sample sent";
const THANK_YOU_PATH = "/free-samples-thanks.html";
const LOGO_URL = "https://little-pause-pages.netlify.app/assets/logo.png";

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

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function buildCustomerEmail({ name, note }) {
    const greetingName = name || "there";
    return [
        `Hi ${greetingName},`,
        "",
        "[PDF attached]",
        "Your Little Pause Pages free sample PDF is attached to this email.",
        "",
        "[Quick reminder]",
        "Open the PDF, print the pages you want, and use them for a calm coloring moment.",
        "",
        note ? `[Your note] ${note}` : "",
        "",
        "Little Pause Pages",
    ]
        .filter(Boolean)
        .join("\n");
}

function buildCustomerHtml({ name, note }) {
    const greetingName = escapeHtml(name || "there");
    const noteHtml = note
        ? `<p style="margin:14px 0 0;font-size:14px;line-height:1.6;color:#3D4F6B;"><strong style="color:#1B2B4A;">Your note:</strong> ${escapeHtml(note)}</p>`
        : "";

    return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#FFFFFF;font-family:Arial,'Helvetica Neue',sans-serif;color:#1B2B4A;">
    <div style="max-width:560px;margin:0 auto;padding:28px 18px;">
      <div style="border-left:5px solid #4A9B8E;padding-left:18px;margin-bottom:22px;">
        <img src="${LOGO_URL}" alt="Little Pause Pages" width="280" style="display:block;width:280px;max-width:100%;height:auto;margin:0 0 18px;">
        <p style="margin:0;font-size:13px;letter-spacing:0.08em;text-transform:uppercase;color:#4A9B8E;font-weight:700;">Free sample PDF</p>
      </div>

      <p style="margin:0 0 14px;font-size:16px;line-height:1.7;color:#1B2B4A;">Hi <strong>${greetingName}</strong>,</p>

      <p style="margin:0 0 16px;font-size:16px;line-height:1.7;color:#1B2B4A;">
        Your <strong>Little Pause Pages free sample PDF</strong> is attached to this email.
      </p>

      <div style="margin:18px 0;padding:14px 16px;background:#F5F1E8;border-radius:10px;border:1px solid #E7DED2;">
        <p style="margin:0 0 8px;font-size:15px;line-height:1.6;color:#1B2B4A;"><strong>Attached file:</strong> Little Pause Pages Free Sample Pack.pdf</p>
        <p style="margin:0;font-size:14px;line-height:1.6;color:#3D4F6B;">Open the PDF, print the pages you want, and use them for a calm coloring moment.</p>
      </div>

      ${noteHtml}

      <p style="margin:20px 0 0;font-size:15px;line-height:1.7;color:#3D4F6B;">If you need anything else, just reply to this message.</p>

      <div style="margin-top:24px;padding-top:16px;border-top:1px solid #E7DED2;">
        <p style="margin:0;font-size:15px;font-weight:700;color:#1B2B4A;">Little Pause Pages</p>
        <p style="margin:4px 0 0;font-size:13px;line-height:1.5;color:#4A9B8E;">Calm moments, creative minds.</p>
      </div>

      <p style="margin:20px 0 0;font-size:12px;line-height:1.6;color:#6B7280;">You received this because you requested the free sample PDF from Little Pause Pages.</p>
    </div>
  </body>
</html>`;
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
            bcc: form.email.toLowerCase() === ADMIN_EMAIL ? "" : ADMIN_EMAIL,
            subject: CUSTOMER_SUBJECT,
            text: buildCustomerEmail(form),
            html: buildCustomerHtml(form),
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
