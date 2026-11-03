# Go-live: Stripe, Resend, GitHub secrets

Owner-only steps. The app already has the webhook route and senders.

## 1) Stripe (test mode first)

Webhook URL (POST, raw body):

- `https://careerspal.com/api/stripe/webhook`
- `https://www.careerspal.com/api/stripe/webhook`

Events:

- `checkout.session.completed`
- `checkout.session.expired`

Vercel / `.env.local`:

- `STRIPE_SECRET_KEY` — `sk_test_...` until you are ready for live
- `STRIPE_WEBHOOK_SECRET` — `whsec_...` for **that** endpoint (test and live have different secrets)
- `NEXT_PUBLIC_SITE_URL` — `https://www.careerspal.com`

Test checkout (no real card):

1. `cd nextjs && npm run verify:go-live` (only runs against `sk_test_`)
2. Post a job, pay with Stripe test card `4242 4242 4242 4242`, any future expiry, any CVC
3. Confirm the listing moves to `pending_review` after the webhook

Live keys (`sk_live_` / live `whsec_`) only after that path works. Do not reuse the test webhook secret on live.

## 2) Resend (custom domain)

Vercel / `.env.local`:

- `RESEND_API_KEY`
- `RESEND_FROM` — `CareersPal <no-reply@careerspal.com>` (or the verified sender you already use)
- `ADMIN_NOTIFICATION_EMAIL` — `info@careerspal.com`

In [Resend → Domains](https://resend.com/domains) add `careerspal.com` (or keep `send.careerspal-email.com` if that domain is already verified). DNS at the registrar:

- SPF `TXT` as Resend shows (`include:amazonses.com` / Resend include)
- DKIM `CNAME` records Resend shows
- Optional DMARC `TXT` on `_dmarc.careerspal.com`

Until the domain is **Verified** in Resend, mail may be rejected. Code falls back to `CareersPal <no-reply@careerspal.com>`.

## 3) GitHub Actions secrets

See `.github/SECRETS.md`. Set the four names there. This machine cannot write GitHub secrets (`gh` is not installed here).

Match Vercel:

- `ALERTS_CRON_SECRET`
- `SOURCING_CRON_SECRET`
- `RESEND_API_KEY` / `RESEND_FROM`
- `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET`
