-- ============================================================
-- Al-Taqwa College — Laptop Loan Tracker
-- 0007: SIMS roster as the student authority; one laptop per student
-- Run this in the Supabase SQL editor AFTER 0006_assignment_not_loan.sql.
-- ============================================================
--
-- Students and devices now come from two separate SIMS exports rather than one
-- combined LWT_SL sheet:
--
--   Current Student List  → students  (identity: name, year level, form)
--   Student Devices SIMS  → devices   (hardware: host name, serial, model)
--
-- They join on student_id, which is what devices.assigned_student_id already
-- models. The device export carries no year level and no reliable name, so the
-- roster is the sole authority on who a student is; the device import no longer
-- writes to students at all.
--
-- ORDER OF OPERATIONS — the reset must come first:
--   1. ../reset_student_assignments.sql   (clears old assignments)
--   2. this file                          (index builds cleanly on empty data)
--   3. import the roster CSV              (Import tab → Student roster)
--   4. import the device CSV              (Import tab → Student holdings)

-- ------------------------------------------------------------
-- 1. Keep the export's provenance instead of discarding it.
--    The SIMS "Year" column records which year the device was issued and is
--    how the importer decides which row is a student's current laptop. Values
--    are not all numeric — "2020-21" appears on 823 rows — so this is text.
-- ------------------------------------------------------------
alter table public.devices add column if not exists source_year text;

-- ------------------------------------------------------------
-- 2. One laptop per student, enforced.
--
--    0006 deliberately left this off because the old CSV contained duplicates
--    and a failing migration was worse than a duplicate row. That reasoning no
--    longer holds: the importer now collapses each student to a single device
--    (newest source_year wins) and every remaining conflict is adjudicated in
--    LLTS_Import_Review.xlsx before the import runs.
--
--    Partial, so archived devices keep their historical assignment without
--    blocking the student's current one.
-- ------------------------------------------------------------
create unique index if not exists devices_one_per_student
  on public.devices (assigned_student_id)
  where assigned_student_id is not null and archived = false;

-- ------------------------------------------------------------
-- 3. Verify. Both should return zero rows.
-- ------------------------------------------------------------
-- Students holding more than one live device:
--   select assigned_student_id, count(*) from public.devices
--    where assigned_student_id is not null and archived = false
--    group by 1 having count(*) > 1;
--
-- Devices assigned to somebody who is not in the roster:
--   select d.serial_number, d.assigned_student_id
--     from public.devices d
--     left join public.students s on s.student_id = d.assigned_student_id
--    where d.assigned_student_id is not null and s.student_id is null;
