# Al-Taqwa College — Laptop Loan Tracker

A mobile-first web app for IT staff to loan student laptops. Enter a **Student ID**,
see the student's details and loan history, get an automatic **eligibility decision**,
and log every issue / return / renewal. Loans run on a **10-day provision period**;
overdue loans surface in-app for follow-up.

Stack: **Vite + React + Supabase + Tailwind**, deployed on **Vercel** — the same
setup as the Al-Taqwa Quran register.

---

## 1. Prerequisites

- **Node.js 18+** (includes `npm`). Install from <https://nodejs.org> (LTS).
  > This machine did not have Node installed — install it first, then reopen your terminal.
- A **Supabase** account (free tier is fine).
- A **Vercel** account for deployment (optional until you're ready to go live).

## 2. Create the Supabase project

1. In Supabase, create a **new project** (dedicated to this app — do **not** reuse the
   Quran register project).
2. Open **SQL Editor** → paste the contents of `supabase/migrations/0001_init.sql` → **Run**.
   This creates the `students`, `devices`, and `loans` tables with security rules.
3. Go to **Authentication → Users → Add user** and create a login for each IT staff
   member (email + password).
4. Go to **Settings → API** and copy the **Project URL** and the **anon/publishable key**.

## 3. Configure & run locally

```bash
cp .env.example .env      # then edit .env with your Supabase URL + anon key
npm install
npm run dev               # open the printed http://localhost:5173
```

`.env` should contain:

```
VITE_SUPABASE_URL=https://YOUR-PROJECT-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-or-publishable-key
```

## 4. Import your data

1. Sign in, open **Import** (home screen card, or the top nav).
2. Choose your `Inventory Teachers-Student Laptops (LWT_SL_2026).csv`.
3. Review the preview (students / devices / active loans), then **Import now**.

The importer seeds three things from each row: the **student**, the **device**
(inventory), and an **active loan** for the laptop they currently hold — so eligibility
and history reflect reality immediately. Seeded loans start a fresh 10-day window from
the import date (so the existing cohort isn't instantly overdue). Re-importing updates
records instead of duplicating them.

Expected CSV columns (extra columns are ignored):
`Student ID`, `Student Name` (`"Last, First"`), `Student Yr.`, `Host Name`,
`Device SN`, `Model`, `Collection Date` (`d/m/yyyy`).

## 5. Deploy to Vercel

1. Push this folder to a Git repo (or use `vercel` CLI).
2. Import the project in Vercel — it auto-detects Vite.
3. Add the two env vars (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) in
   **Project → Settings → Environment Variables**.
4. Deploy. `vercel.json` already handles SPA routing.

---

## How it works

- **Eligibility:** a student may hold **one** laptop at a time. If they have an active
  loan, they're **not eligible** and the existing loan is shown with Return / Renew.
  This is enforced both in the UI and by a database unique index.
- **10-day provision:** issuing sets the due date 10 days out. **Renew** extends it by
  another 10 days. Overdue = past the due date; these appear on Home and in **Loans**.
- **Screens:** Home (action cards + stats), Loan (student lookup — the main screen),
  Devices (inventory), Loans (all transactions with filters), Import.

## Roadmap (not in v1)

- **Email reminders** when a loan passes its 10-day window (needs an email provider +
  scheduler). The `loans.reminder_sent_at` column is already in place.
- **Lenovo warranty sync** — auto-fill each device's warranty expiry from its serial via
  the official Lenovo Warranty API (needs a Lenovo **Client-ID** and a serverless proxy).
  The `devices.warranty_expiry` column is already in place.

## Project structure

```
src/
  supabase.js          Supabase client
  lib.js               dates, eligibility, CSV parsing helpers
  actions.js           issue / return / renew loan operations
  ui.jsx               design-system primitives (white + navy theme)
  LoginScreen.jsx      email/password sign-in
  BottomNav.jsx        mobile bottom navigation
  App.jsx              auth session, data layer, navigation shell
  screens/
    Home.jsx  Lookup.jsx  Devices.jsx  Loans.jsx  Import.jsx  common.jsx
supabase/migrations/0001_init.sql
```
