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

## Alerts automation (daily emails)

If you previously relied on Vercel Cron for alerts, use GitHub Actions schedule:

1) In Vercel project env, set:
- `ALERTS_CRON_SECRET` to a random string

2) In GitHub repo → Settings → Secrets and variables → Actions, add:
- `CAREERSPAL_ALERTS_URL` = `https://www.careerspal.com/api/alerts/daily`
- `CAREERSPAL_ALERTS_CRON_SECRET` = same value as `ALERTS_CRON_SECRET`

3) Workflow file:
- `.github/workflows/careerspal-alerts-daily.yml` runs daily at `08:00 UTC` and also supports manual run (`workflow_dispatch`).