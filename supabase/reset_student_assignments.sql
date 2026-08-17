-- ============================================================
-- Al-Taqwa College — Laptop Loan Tracker
-- ONE-TIME OPERATIONAL SCRIPT — not a migration. Destructive.
-- ============================================================
--
-- Clears every student-laptop assignment so the SIMS exports can be loaded as
-- the new source of truth. Run this ONCE, immediately before
-- migrations/0007_roster_and_one_device.sql.
--
-- Deliberately NOT a migration: migrations are expected to be safe to re-run,
-- and re-running this would wipe assignments that the import had since
-- rebuilt. It lives outside migrations/ so it can never be applied by accident.
--
-- WHAT THIS TOUCHES
--   devices where lnb is null  →  assignment cleared, status back to 'available'
--
-- WHAT THIS LEAVES ALONE
--   • The 19 LNB loan laptops and their cabins — the SIMS export contains no
--     LNB rows and none of its serials collide with LNB stock, so loan
--     inventory is entirely unaffected.
--   • The loans table — every row in it is an LNB loan by the 0006 trigger.
--   • students — the roster import upserts over the top; nothing is deleted.
--     Students who have left keep their row and simply hold no device.

begin;

-- Sanity check before the write: this is what is about to be cleared.
--   select count(*) from public.devices
--    where lnb is null and assigned_student_id is not null;

update public.devices
   set assigned_student_id = null,
       status = 'available'
 where lnb is null
   and (assigned_student_id is not null or status = 'assigned');

-- Confirm the loan fleet survived untouched — expect 19 rows, all 'available'.
--   select count(*) filter (where status = 'available') as available,
--          count(*) as total
--     from public.devices where lnb is not null;

commit;
