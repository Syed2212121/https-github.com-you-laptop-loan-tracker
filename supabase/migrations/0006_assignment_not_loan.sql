-- ============================================================
-- Al-Taqwa College — Laptop Loan Tracker
-- 0006: assignment is not a loan; SL laptops are never loaned
-- Run this in the Supabase SQL editor AFTER 0005_device_cabin.sql.
-- ============================================================
--
-- The LWT_SL import recorded "this student holds this laptop" as an ACTIVE
-- LOAN. Combined with loans_one_active_per_student (0001), that used up every
-- student's one permitted active loan on their own SL laptop, so an LNB loan
-- laptop could not be issued to anyone — the insert was rejected outright.
--
-- Assignment (the student's own SL laptop, ~permanent) and a loan (a temporary
-- LNB loaner, 10 days) are different things and now live in different places.

-- ------------------------------------------------------------
-- 1. Assignment gets a real home.
-- ------------------------------------------------------------
alter table public.devices add column if not exists assigned_student_id text
  references public.students(student_id) on delete set null;

create index if not exists devices_assigned_student_idx
  on public.devices (assigned_student_id);

-- ------------------------------------------------------------
-- 2. Backfill it from the loans the import created against SL devices.
--    Done before the delete below, or the link is lost.
-- ------------------------------------------------------------
update public.devices d
   set assigned_student_id = l.student_id
  from public.loans l
 where l.device_id = d.id
   and l.status = 'active'
   and d.lnb is null
   and d.assigned_student_id is null;

-- ------------------------------------------------------------
-- 3. Those rows were never loans. Remove them.
-- ------------------------------------------------------------
delete from public.loans l
 using public.devices d
 where d.id = l.device_id
   and d.lnb is null;

-- ------------------------------------------------------------
-- 4. An SL laptop is 'assigned' — neither available nor on loan.
--    The status check is declared inline in 0001, so its generated name is
--    looked up rather than guessed.
-- ------------------------------------------------------------
do $$
declare cname text;
begin
  select con.conname into cname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace n on n.oid = rel.relnamespace
   where n.nspname = 'public'
     and rel.relname = 'devices'
     and con.contype = 'c'
     and pg_get_constraintdef(con.oid) ilike '%status%';
  if cname is not null then
    execute format('alter table public.devices drop constraint %I', cname);
  end if;
end $$;

alter table public.devices add constraint devices_status_check
  check (status in ('available','on_loan','retired','assigned'));

update public.devices
   set status = 'assigned'
 where lnb is null
   and assigned_student_id is not null;

-- ------------------------------------------------------------
-- 5. Make the rule structural: only LNB stock can ever be loaned.
--    The UI already gates on this, but the UI is how the 468 rows got in.
--    Created AFTER step 3 so the cleanup above can't trip over it.
-- ------------------------------------------------------------
create or replace function public.assert_loan_device_is_loanable()
returns trigger language plpgsql as $$
begin
  if not exists (
    select 1 from public.devices d
     where d.id = new.device_id and d.lnb is not null
  ) then
    raise exception
      'Device % has no LNB. SL student laptops are never loaned.', new.device_id
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists loans_device_must_be_loanable on public.loans;
create trigger loans_device_must_be_loanable
  before insert or update of device_id on public.loans
  for each row execute function public.assert_loan_device_is_loanable();

-- Note: no unique constraint on assigned_student_id. One laptop per student is
-- the intent, but the CSV may already contain duplicates and a failing
-- migration is worse than a duplicate row. Check after the data is in:
--   select assigned_student_id, count(*) from public.devices
--    where assigned_student_id is not null
--    group by 1 having count(*) > 1;
