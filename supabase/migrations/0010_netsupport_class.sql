-- ============================================================
-- Al-Taqwa College — Laptop Loan Tracker
-- 0010: device_netsupport.department → class
-- Run this in the Supabase SQL editor AFTER 0009_intune_netsupport.sql.
-- Safe to run more than once.
-- ============================================================
--
-- 0009 named this column after the DNA field it expected to find, "Department".
-- The export our DNA console actually produces has no such column: it writes
-- "Class" (the year level, e.g. "8") and "Form" (e.g. "8I"). So `department`
-- was a column that could only ever have been null, named after a field this
-- school's DNA does not publish.
--
-- Renaming rather than adding, because nothing was ever imported into
-- department — there is no data to preserve and no reason to keep a dead
-- column beside the live one.
--
-- `class` needs no quoting in Postgres (it is non-reserved) and matches
-- students.class from 0001, which holds the same kind of value.

begin;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'device_netsupport'
      and column_name = 'department'
  ) then
    alter table public.device_netsupport rename column department to class;
  end if;
end $$;

comment on column public.device_netsupport.class is
  'DNA "Class" — the student''s year level as DNA records it against the machine, e.g. "8". Reference only; students.class is the authority for a student''s year.';

commit;

-- ============================================================
-- VERIFY (run separately, after committing)
-- ============================================================
--
-- The column is there and department is gone:
--   select column_name, data_type
--   from information_schema.columns
--   where table_schema = 'public' and table_name = 'device_netsupport'
--   order by ordinal_position;
--
-- After re-importing the DNA export, class should be populated, not null.
-- Expect a small set of year levels and no nulls:
--   select class, count(*) from public.device_netsupport
--   group by class order by count(*) desc;
