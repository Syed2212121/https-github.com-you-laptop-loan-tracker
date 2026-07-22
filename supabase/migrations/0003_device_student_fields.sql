-- ============================================================
-- Al-Taqwa College — Laptop Loan Tracker
-- 0003: student "form" + reserved device fields (restructure)
-- Run this in the Supabase SQL editor of the LLTS project.
-- ============================================================

-- Split of "Student Yr." — class (e.g. "4") stays in students.class,
-- the form group (e.g. "I") goes here.
alter table public.students add column if not exists form text;               -- e.g. "I"

-- Reserved device fields — shown as "—" for now, no data source wired yet.
alter table public.devices  add column if not exists insurance_log text;      -- reserved
alter table public.devices  add column if not exists current_condition text;  -- reserved
alter table public.devices  add column if not exists it_support text;         -- reserved, not yet shown

-- Note: "Insurance" reuses the existing devices.insurance_status column;
--       "Warranty" reuses the existing devices.warranty_expiry column (deferred).
