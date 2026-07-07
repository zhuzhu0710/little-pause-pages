import { sendGmailMessage } from "./_shared/gmail.js";

const PDF_ASSET_PATH = "/assets/free-sample-pack.pdf";
const CUSTOMER_SUBJECT = "【Little Pause Pages】Your Free Sample PDF";
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

function buildCustomerEmail({ name, note }) {
    const greetingName = name || "there";
    return [
        `Hi ${greetingName},`,
        "",
        "【Your free sample is attached】",
        "Thanks for requesting the Little Pause Pages free sample pack. The printable PDF is attached to this email, so you can print it right away.",
        "",
        "【Quick tip】",
        "Print the pages on plain letter-size paper. For toddlers, a crayon or washable marker is enough to begin.",
        "",
        "【Need help?】",
        "If you need anything else, just reply to this message.",
        "",
        note ? `【Your note】 ${note}` : "",
        "Little Pause Pages",
    ]
        .filter(Boolean)
        .join("\n");
}

function buildCustomerHtml({ name, note }) {
    const greetingName = name || "there";
    const noteHtml = note
        ? `<div style="margin-top:18px;padding:14px 16px;border-left:4px solid #4A9B8E;background:#F6FBFA;border-radius:10px;"><strong style="color:#1B2B4A;">【Your note】</strong><br>${escapeHtml(note)}</div>`
        : "";

    return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#F5F1E8;font-family:Arial,'Helvetica Neue',sans-serif;color:#1B2B4A;">
    <div style="max-width:680px;margin:0 auto;padding:28px 16px;">
      <div style="background:#FFFFFF;border-radius:18px;overflow:hidden;border:1px solid #E7DED2;">
        <div style="display:flex;align-items:stretch;">
          <div style="width:118px;background:#4A9B8E;text-align:center;padding:24px 14px;color:#FFFFFF;">
            <img src="${LOGO_URL}" alt="Little Pause Pages" width="74" style="display:block;margin:0 auto 18px;border-radius:14px;">
            <div style="font-size:13px;line-height:1.35;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;">Little<br>Pause<br>Pages</div>
          </div>
          <div style="padding:28px 28px 26px;flex:1;">
            <div style="display:inline-block;padding:7px 11px;background:#FDE8DE;color:#A24B34;border-radius:999px;font-size:13px;font-weight:700;margin-bottom:14px;">【Free PDF Attached】</div>
            <h1 style="margin:0 0 12px;font-size:26px;line-height:1.25;color:#1B2B4A;">Your sample pages are ready</h1>
            <p style="font-size:16px;line-height:1.7;margin:0 0 18px;">Hi <strong>${escapeHtml(greetingName)}</strong>, thanks for requesting the Little Pause Pages free sample pack. The printable PDF is attached to this email.</p>
            <div style="padding:16px 18px;background:#FBF8F3;border-radius:14px;margin:18px 0;">
              <p style="margin:0 0 8px;font-size:15px;line-height:1.6;"><strong>【Print】</strong> Open the attached PDF and print the pages you want to use.</p>
              <p style="margin:0 0 8px;font-size:15px;line-height:1.6;"><strong>【Color】</strong> Give your toddler one page and a few crayons.</p>
              <p style="margin:0;font-size:15px;line-height:1.6;"><strong>【Pause】</strong> Use the pages during waiting time, travel, or quiet moments at home.</p>
            </div>
            ${noteHtml}
            <p style="font-size:15px;line-height:1.7;margin:20px 0 0;">If you need anything else, just reply to this message.</p>
            <p style="font-size:15px;font-weight:700;margin:16px 0 0;color:#4A9B8E;">Little Pause Pages</p>
          </div>
        </div>
      </div>
      <p style="font-size:12px;line-height:1.6;color:#6B7280;text-align:center;margin:14px 0 0;">You received this because you requested the free sample PDF from Little Pause Pages.</p>
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

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
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
