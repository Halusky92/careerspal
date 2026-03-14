This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

## Sourcing automation (Greenhouse-only, MVP)

The Greenhouse sourcing pipeline can run end-to-end via:

- `POST /api/admin/sourcing/pipeline/greenhouse` (admin session required)
- `GET /api/admin/sourcing/pipeline/greenhouse?secret=...` (cron-friendly)

Helpful admin-only utilities:

- `POST /api/admin/sourcing/candidates/enrich-salary-bulk` (batch fetch salary from official job pages)
- `POST /api/admin/sourcing/cleanup/unpublish-low-score` (unpublish already-published sourced jobs below a score threshold)
- `POST /api/admin/sourcing/cleanup/unpublish-implausible-salary` (unpublish already-published sourced jobs with implausible salary like "$1-$2")

Environment variables:

- `SOURCING_CRON_SECRET`: required for cron calls (query `?secret=` must match)
- `SOURCING_AUTO_PUBLISH_SCORE`: optional (default `85`)
- `SOURCING_AUTO_PUBLISH_SOURCES`: optional (default `greenhouse`)

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
