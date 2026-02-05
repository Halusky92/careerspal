# Supabase Setup

## 1) Create project

Create a new Supabase project and grab:
- Project URL
- Anon public key

Set them in `nextjs/.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## 2) Run schema

Open Supabase SQL editor and run:

```
nextjs/supabase/schema.sql
```

This creates tables, indexes, triggers, and RLS policies.

The `jobs` table is aligned with the current app shape (salary, type, remote_policy, tags/tools/benefits, match_score, plan fields).

## 3) Auth profiles

The schema includes a trigger that auto-creates a `profiles` row on user sign-up.

## 4) Supabase Auth

Enable Google provider in Supabase Auth settings and set the redirect URL:

```
http://localhost:3000/auth
```

## 5) Test client

Visit:

```
/supabase-test
```

You should see a ✅ connection message if the env vars are correct.
