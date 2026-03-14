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
- `GET /api/admin/sourcing/pipeline/greenhouse?secret=...` (cron-friendly)

### Cron without Vercel Pro (recommended)

If Vercel asks you to upgrade for Cron Jobs, use **GitHub Actions scheduled workflow** instead.

1) In Vercel project env, set:
- `SOURCING_CRON_SECRET` to a random string

2) In GitHub repo → Settings → Secrets and variables → Actions, add:
- `CAREERSPAL_PIPELINE_URL` = `https://www.careerspal.com/api/admin/sourcing/pipeline/greenhouse`
- `CAREERSPAL_CRON_SECRET` = same value as `SOURCING_CRON_SECRET`

3) Workflow file:
- `.github/workflows/careerspal-greenhouse-daily.yml` runs daily at `06:00 UTC` and also supports manual run (`workflow_dispatch`).

## Alerts automation (daily emails)

If you previously relied on Vercel Cron for alerts, use GitHub Actions schedule:

1) In Vercel project env, set:
- `ALERTS_CRON_SECRET` to a random string

2) In GitHub repo → Settings → Secrets and variables → Actions, add:
- `CAREERSPAL_ALERTS_URL` = `https://www.careerspal.com/api/alerts/daily`
- `CAREERSPAL_ALERTS_CRON_SECRET` = same value as `ALERTS_CRON_SECRET`

3) Workflow file:
- `.github/workflows/careerspal-alerts-daily.yml` runs daily at `08:00 UTC` and also supports manual run (`workflow_dispatch`).