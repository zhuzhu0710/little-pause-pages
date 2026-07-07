# Free Sample Automation

This project sends the free sample PDF immediately after a visitor submits the request form.

## Request flow

1. The form on `samples.html` collects the visitor name, email, and optional note.
2. The form posts directly to `/.netlify/functions/send-free-sample-request`.
3. The function emails the PDF attachment to the visitor immediately.
4. The function also emails `little.pause.pages@gmail.com` a simple internal notification.
5. After the email is sent, the visitor is redirected to `free-samples-thanks.html`.

## Files

- `assets/free-sample-pack.pdf` - printable free sample pack PDF
- `samples.html` - free sample request form
- `free-samples-thanks.html` - thank-you page after successful delivery
- `netlify/functions/send-free-sample-request.js` - immediate email sender
- `netlify/functions/_shared/gmail.js` - Gmail API helpers

## Environment variables

Required for Gmail sending:

- `GMAIL_CLIENT_ID`
- `GMAIL_CLIENT_SECRET`
- `GMAIL_REFRESH_TOKEN`

Optional:

- `GMAIL_SENDER_EMAIL`
- `SAMPLE_PACK_PDF_URL`

## Notes

- Free samples use immediate email delivery.
- Free samples do not use the Contact page form handling path.
- The Contact page can still use Netlify Forms independently.
