# Admin access

## Roles

- `admin` is based on email: `admin@careerspal.com`
- other Google users default to `candidate`

## Admin routes

- `/dashboard/admin`

## Notes

- Protects admin pages via `middleware.ts`
- For production, store roles in database instead of localStorage

## Sourcing automation (Greenhouse-only)

Pipeline endpoints:

- `POST /api/admin/sourcing/pipeline/greenhouse` (admin session required)
- `GET /api/admin/sourcing/pipeline/greenhouse?secret=...` (full run, GitHub Actions)
- `GET /api/cron/sourcing/pipeline/greenhouse` (Vercel Hobby: one board per slot)

### Production cron

Vercel Hobby cannot finish every board in one function. Morning slots in `vercel.json` hit `/api/cron/sourcing/pipeline/greenhouse` at 06:00 / 06:20 / 06:40 / 07:00 UTC (one stale board each, 60s budget). GitHub Actions still runs the full pipeline at 06:15 UTC.

1) In Vercel project env (Production), set:
- `SOURCING_CRON_SECRET` to a random string

2) Same value in `nextjs/.env.local` for local tests.

3) In GitHub repo → Settings → Secrets and variables → Actions, add:
- `CAREERSPAL_PIPELINE_URL` = `https://www.careerspal.com/api/admin/sourcing/pipeline/greenhouse`
- `CAREERSPAL_CRON_SECRET` = same value as `SOURCING_CRON_SECRET`

Admin dashboard → Sourcing shows last cron health (ok / failed / overdue) without opening Vercel logs.

## Alerts automation (Tuesday / Friday emails)

Sending is GitHub Actions only (no Vercel cron for `/api/alerts/daily`).

1) In Vercel project env, set:
- `ALERTS_CRON_SECRET` to a random string
- `RESEND_API_KEY` and `RESEND_FROM` (verified domain)
- `NEXT_PUBLIC_SITE_URL` = `https://www.careerspal.com`

2) In GitHub repo → Settings → Secrets and variables → Actions, add:
- `CAREERSPAL_ALERTS_URL` = `https://www.careerspal.com/api/alerts/daily`
- `CAREERSPAL_ALERTS_CRON_SECRET` = same value as `ALERTS_CRON_SECRET`

3) Workflow file:
- `.github/workflows/careerspal-alerts-daily.yml` runs daily at `08:00 UTC`; the API sends only Tuesday and Friday UTC. Manual run: `workflow_dispatch`. Optional `?force=1` to send on other days.

Guest subscribe is double opt-in: no digest until the confirm link is clicked.

## Stripe webhook

Route: `POST /api/stripe/webhook` (`GET` returns the expected events).

Register in Stripe Dashboard (test, then live):

- URL: `https://www.careerspal.com/api/stripe/webhook`
- Events: `checkout.session.completed`, `checkout.session.expired`
- Put the endpoint signing secret in Vercel `STRIPE_WEBHOOK_SECRET`

`npm run verify:go-live` (from `nextjs/`) only talks to `sk_test_` keys. It does not charge a card.

## GitHub secrets (names only)

Repo Settings → Secrets and variables → Actions. Full table: `/.github/SECRETS.md`

- `CAREERSPAL_ALERTS_URL`
- `CAREERSPAL_ALERTS_CRON_SECRET`
- `CAREERSPAL_PIPELINE_URL`
- `CAREERSPAL_CRON_SECRET`