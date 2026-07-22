-- ============================================================
-- Al-Taqwa College — Laptop Loan Tracker
-- Initial schema: students, devices, loans
-- Run this in the Supabase SQL editor of your NEW project.
-- ============================================================

-- Needed for gen_random_uuid()
create extension if not exists "pgcrypto";

-- ------------------------------------------------------------
-- STUDENTS  (imported from the LWT_SL CSV; student_id is the key)
-- ------------------------------------------------------------
create table if not exists public.students (
  student_id  text primary key,               -- e.g. "21816"
  first_name  text,
  last_name   text,
  full_name   text,
  class       text,                            -- Student Yr., e.g. "4I"
  details     jsonb default '{}'::jsonb,        -- reserved for future fields
  notes       text,
  created_at  timestamptz not null default now()
);

-- ------------------------------------------------------------
-- DEVICES  (laptop inventory)
-- ------------------------------------------------------------
create table if not exists public.devices (
  id               uuid primary key default gen_random_uuid(),
  host_name        text,                        -- e.g. "SL-21816"
  serial_number    text unique,                 -- e.g. "PW0KX282"
  model            text,
  status           text not null default 'available'
                   check (status in ('available','on_loan','retired')),
  warranty_expiry  date,                         -- reserved for Lenovo API phase
  insurance_status text,                         -- reserved
  notes            text,
  created_at       timestamptz not null default now()
);

-- ------------------------------------------------------------
-- LOANS  (every issue / return — the audit trail)
-- ------------------------------------------------------------
create table if not exists public.loans (
  id                  uuid primary key default gen_random_uuid(),
  student_id          text not null references public.students(student_id) on delete cascade,
  device_id           uuid not null references public.devices(id) on delete restrict,
  issued_by           uuid references auth.users(id),
  issued_at           timestamptz not null default now(),   -- start of the 10-day window
  due_at              timestamptz not null,                 -- issued_at + 10 days
  original_issue_date date,                                 -- CSV collection date (seeded loans)
  returned_at         timestamptz,
  renewed_count       integer not null default 0,
  reminder_sent_at    timestamptz,                          -- reserved for email phase
  status              text not null default 'active'
                      check (status in ('active','returned')),
  notes               text,
  created_at          timestamptz not null default now()
);

-- Enforce one ACTIVE loan per student (the core eligibility rule)
create unique index if not exists loans_one_active_per_student
  on public.loans (student_id)
  where (status = 'active');

-- A device can only be out on one active loan at a time
create unique index if not exists loans_one_active_per_device
  on public.loans (device_id)
  where (status = 'active');

create index if not exists loans_student_idx on public.loans (student_id);
create index if not exists loans_device_idx  on public.loans (device_id);
create index if not exists loans_status_idx  on public.loans (status);
create index if not exists loans_due_idx     on public.loans (due_at);
create index if not exists devices_status_idx on public.devices (status);

-- ------------------------------------------------------------
-- ROW LEVEL SECURITY
-- v1: any authenticated staff member has full access.
-- ------------------------------------------------------------
alter table public.students enable row level security;
alter table public.devices  enable row level security;
alter table public.loans    enable row level security;

drop policy if exists "staff full access" on public.students;
create policy "staff full access" on public.students
  for all to authenticated using (true) with check (true);

drop policy if exists "staff full access" on public.devices;
create policy "staff full access" on public.devices
  for all to authenticated using (true) with check (true);

drop policy if exists "staff full access" on public.loans;
create policy "staff full access" on public.loans
  for all to authenticated using (true) with check (true);
