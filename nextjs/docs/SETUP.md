# Setup

## Environment variables

Create `nextjs/.env.local` with (start from `.env.example`):

```
API_KEY=your_gemini_api_key
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
STRIPE_SECRET_KEY=your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=your_stripe_webhook_secret
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
RESEND_API_KEY=your_resend_api_key
RESEND_FROM="CareersPal <onboarding@resend.dev>"
ADMIN_NOTIFICATION_EMAIL=info@careerspal.com
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```
Use Stripe test keys locally/staging. Switch to live keys only for production and update webhook secrets accordingly.

## Supabase schema

Use the SQL editor in Supabase and run:

```
nextjs/supabase/schema.sql
```

This creates all tables, indexes, triggers, and RLS policies for the job board.

## Supabase Auth

Enable the Google provider in Supabase Auth settings and set redirect URL to:

```
http://localhost:3000/auth
```

## Seed data (optional)

Run:

```
npm run seed:supabase
```

Creates demo users, companies, and jobs.

Restart dev server:

```
npm run dev
```

## AI endpoints

- `POST /api/ai/chat`
- `POST /api/ai/job-description`
- `POST /api/ai/resume-audit`
