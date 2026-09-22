# Digital Heroes — Next.js + Supabase

Built from the Digital Heroes PRD (Level 1). Golf score tracking, monthly prize draws,
and charity giving, backed by a real Supabase project. Checkout is simulated (no real
card is charged) — everything else (auth, scores, draws, charities, winners) reads and
writes real Supabase tables.

## 1. Run it locally

```bash
npm install
npm run dev
```

`.env.local` already has this project's Supabase URL and anon key. If you point this at
a different Supabase project, copy `.env.example` to `.env.local` and fill in the two
values from **Project Settings → API Keys** in that project.

## 2. Database

**If this is a brand new Supabase project:** run `sql/schema.sql` in the SQL editor. It
creates every table, the "keep latest 5 scores" trigger, the auto-create-profile-on-signup
trigger, row-level security policies (including an `is_admin()` helper so admins can manage
everything, while regular users can only touch their own rows), a private Storage bucket for
winner proof screenshots, and seeds 6 charities.

**If you already ran an earlier version of the schema** (from earlier in this chat), run
`sql/patch.sql` instead — it only adds the one thing that version was missing: a policy
letting a logged-in user insert/update their own subscription row (needed for the simulated
checkout to work).

## 3. Create an admin

1. Sign up normally through the app (`/signup`) with the email you want to use as admin.
2. In the SQL editor, run:
   ```sql
   update profiles set role = 'admin'
   where id = (select id from auth.users where email = 'admin@yourdomain.com');
   ```
3. Log out and back in — you'll land on `/admin` instead of `/dashboard`.

## 4. Deploy to Vercel

1. Push this folder to a **new** GitHub repo.
2. In a **new** Vercel account, "Import Project" from that repo.
3. Under Settings → Environment Variables, add:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Deploy. No build config changes are needed — it's a standard Next.js App Router project.

## What's implemented

- **Auth** — Supabase email/password, a `profiles` row is auto-created on signup via a
  DB trigger, admins can't self-promote (RLS + column-level grants block writing your own
  `role` column from the client).
- **Subscriptions** — monthly (₹499) / yearly (₹4,990), simulated checkout, live status
  check (active / cancelled-but-still-has-access / lapsed) computed from `renews_on`.
- **Scores** — Stableford 1–45, one per date, a DB trigger keeps only the latest 5 per user.
- **Draws** — admin picks random or score-frequency-weighted, simulates before publishing,
  40/35/25% pool split across 5/4/3-number matches, 5-match jackpot rolls over if unclaimed.
- **Charities** — directory with search/filter, profiles with events, featured charity,
  minimum 10% contribution (raisable), separate one-off donations.
- **Winner verification** — screenshot upload to a private Supabase Storage bucket, admin
  approve/reject, payment pending → paid.
- **Dashboards** — full user dashboard and five-tab admin panel (reports, users, draws,
  charities, winners).

## Known limitations / please verify before evaluation

- I have **not** run this against your live Supabase project end-to-end — walk through
  signup → subscribe → score entry → admin draw → winner verification yourself and tell me
  if anything errors, especially around storage bucket policies and admin RLS.
- Payment is simulated. Real Stripe test mode would add a Stripe account, a checkout
  session API route, and a webhook route — ask if you want this added.
- `charity_pct` and `charity_id` (and `name`) are the only profile columns users can update
  themselves, enforced via a column-level `grant`; widen it if a future feature needs more.
- A newer ESLint rule (`react-hooks/set-state-in-effect`) flags a few of the
  data-fetch-on-mount patterns used across the dashboard/admin pages. They don't block the
  build (`npm run build` passes) and are a common pattern for client-rendered dashboards,
  but could be refactored to Server Components + React Query later if you want it clean.

---

Scaffolded with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

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

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
