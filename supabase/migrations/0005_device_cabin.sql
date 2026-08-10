-- ============================================================
-- Al-Taqwa College — Laptop Loan Tracker
-- 0005: loan laptop cabins + who handed the laptop over
-- Run this in the Supabase SQL editor of the LLTS project.
-- ============================================================

-- Which of the three physical cabins a loan laptop lives in.
-- Null until the cabin CSV is imported (Import tab → Loan laptop cabins).
alter table public.devices add column if not exists cabin text
  check (cabin is null or cabin in ('yr3_5','yr6_7','yr8_9'));

create index if not exists devices_cabin_idx on public.devices (cabin);

-- Which cabin custodian physically handed the laptop over, e.g. "Rudi".
-- Distinct from loans.issued_by, which is the logged-in auth.users account.
alter table public.loans add column if not exists handed_over_by text;
