# Free Sample Automation

This project uses a Netlify form for sample requests and a scheduled Netlify function to process new requests and email the PDF automatically.

## Request flow

1. The `free-sample-request` form on `samples.html` collects the visitor name, email, and optional note.
2. Netlify form notifications should send a copy of each request to `little.pause.pages@gmail.com`.
3. The hourly Netlify function checks for new unread request emails.
4. When it finds a request, it emails the PDF to the visitor and marks the request as processed.
5. If the Gmail inbox notification is not available yet, the function can fall back to the Netlify submissions API when `NETLIFY_API_TOKEN` is set.

## Files

- `assets/free-sample-pack.pdf` - printable free sample pack PDF
- `netlify/functions/process-sample-requests.js` - hourly processor
- `netlify/functions/_shared/gmail.js` - Gmail API helpers
- `netlify/functions/_shared/netlify.js` - Netlify submissions helpers

## Environment variables

### Required for Gmail sending

- `GMAIL_CLIENT_ID`
- `GMAIL_CLIENT_SECRET`
- `GMAIL_REFRESH_TOKEN`
- `GMAIL_SENDER_EMAIL`

### Optional fallback

- `NETLIFY_API_TOKEN`
- `NETLIFY_SITE_ID` - only needed if the function cannot read the site id from the runtime context

## Gmail setup notes

- Create the Gmail notification in Netlify so the request mail lands in `little.pause.pages@gmail.com`.
- Use the Gmail OAuth scopes that allow reading, modifying, and sending mail, so the hourly job can mark processed requests as read.
- Keep the subject line `Little Pause Pages free sample request` so the inbox query can find the request reliably.
