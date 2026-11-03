# Required GitHub Actions secrets

Set these in **GitHub → repo Settings → Secrets and variables → Actions**.
This file only names secrets; values cannot be committed.

## Alerts (`.github/workflows/careerspal-alerts-daily.yml`)

| Secret | Value |
| --- | --- |
| `CAREERSPAL_ALERTS_URL` | `https://www.careerspal.com/api/alerts/daily` |
| `CAREERSPAL_ALERTS_CRON_SECRET` | Same as Vercel env `ALERTS_CRON_SECRET` |

## Greenhouse sourcing (`.github/workflows/careerspal-greenhouse-daily.yml`)

| Secret | Value |
| --- | --- |
| `CAREERSPAL_PIPELINE_URL` | `https://www.careerspal.com/api/admin/sourcing/pipeline/greenhouse` |
| `CAREERSPAL_CRON_SECRET` | Same as Vercel env `SOURCING_CRON_SECRET` |

Do not put Stripe or Resend keys in GitHub Actions. Those belong in Vercel project env.
