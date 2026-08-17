-- ============================================================
-- Al-Taqwa College — Laptop Loan Tracker
-- 0008: cabin custodians — read-only inventory, lend from own cabin
-- Run this in the Supabase SQL editor AFTER 0004_staff_only_policies.sql.
-- Safe to run more than once.
-- ============================================================
--
-- Adds a third role between "admin" and "full staff": a CABIN CUSTODIAN who
-- looks after one physical cupboard of loan laptops.
--
--   admin          is_admin = true            everything, including delete
--   full staff     cabin is null              everything except delete
--   cabin staff    cabin = 'yr3_5' | …        read-only inventory; may issue
--                                             and return loans for laptops in
--                                             their own cabin only
--
-- WHY CABIN STAFF STILL READ EVERY LOAN LAPTOP
-- Eligibility ("does this student already hold a loaner?") is decided by
-- matching a loan to its device. If a laptop from another cabin were
-- unreadable, that match would fail, the existing loan would be ignored, and
-- the student could borrow a second laptop from a different cabin. Loan
-- laptops carry no student data — asset number, model, cabin — so reading all
-- of them is the cheaper side of that trade. What cabin staff must NOT see is
-- the ~1,815 student-owned SL laptops, and those stay hidden.

begin;

-- ------------------------------------------------------------
-- 1. STAFF GAINS A CABIN
-- Null means "not cabin-scoped" — i.e. an admin or a full staff member.
-- ------------------------------------------------------------
alter table public.staff add column if not exists cabin text
  check (cabin is null or cabin in ('yr3_5','yr6_7','yr8_9'));

comment on column public.staff.cabin is
  'Cabin custodians are scoped to one cupboard. Null = full staff / admin.';

-- ------------------------------------------------------------
-- 2. HELPERS
-- security definer so they can read public.staff regardless of its own RLS;
-- search_path pinned, same shape as is_staff() / is_admin().
-- ------------------------------------------------------------

-- The caller's cabin, or null if they are not cabin-scoped.
create or replace function public.staff_cabin()
returns text
language sql
security definer
stable
set search_path = public
as $$
  select cabin from public.staff where id = auth.uid();
$$;

-- True when the caller is restricted to a single cabin.
create or replace function public.is_cabin_scoped()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select coalesce((select cabin is not null from public.staff where id = auth.uid()), false);
$$;

revoke execute on function public.staff_cabin()     from public, anon;
revoke execute on function public.is_cabin_scoped() from public, anon;
grant  execute on function public.staff_cabin()     to authenticated;
grant  execute on function public.is_cabin_scoped() to authenticated;

-- ------------------------------------------------------------
-- 3. DEVICES
-- Cabin staff read loan laptops only (lnb is not null) — never the student
-- SL fleet. They cannot write to devices at all: inventory is read-only for
-- them, so archiving, editing and the CSV importers stay with full staff.
-- ------------------------------------------------------------
drop policy if exists "devices read"   on public.devices;
drop policy if exists "devices insert" on public.devices;
drop policy if exists "devices update" on public.devices;
drop policy if exists "devices delete" on public.devices;

create policy "devices read" on public.devices for select to authenticated
  using (
    public.is_staff()
    and (not public.is_cabin_scoped() or lnb is not null)
  );

create policy "devices insert" on public.devices for insert to authenticated
  with check (public.is_staff() and not public.is_cabin_scoped());

create policy "devices update" on public.devices for update to authenticated
  using       (public.is_staff() and not public.is_cabin_scoped())
  with check  (public.is_staff() and not public.is_cabin_scoped());

create policy "devices delete" on public.devices for delete to authenticated
  using (public.is_admin());

-- ------------------------------------------------------------
-- 4. STUDENTS
-- Everyone on staff may read every student — a custodian has to be able to
-- look up who is standing in front of them. Only full staff may write, so a
-- custodian cannot edit the roster or re-run an import.
-- ------------------------------------------------------------
drop policy if exists "students read"   on public.students;
drop policy if exists "students insert" on public.students;
drop policy if exists "students update" on public.students;
drop policy if exists "students delete" on public.students;

create policy "students read" on public.students for select to authenticated
  using (public.is_staff());

create policy "students insert" on public.students for insert to authenticated
  with check (public.is_staff() and not public.is_cabin_scoped());

create policy "students update" on public.students for update to authenticated
  using       (public.is_staff() and not public.is_cabin_scoped())
  with check  (public.is_staff() and not public.is_cabin_scoped());

create policy "students delete" on public.students for delete to authenticated
  using (public.is_admin());

-- ------------------------------------------------------------
-- 5. LOANS
-- Read: every loan, for the eligibility reason above.
-- Write: full staff anywhere; cabin staff only for a laptop in their cabin.
-- ------------------------------------------------------------
drop policy if exists "loans read"   on public.loans;
drop policy if exists "loans insert" on public.loans;
drop policy if exists "loans update" on public.loans;
drop policy if exists "loans delete" on public.loans;

create policy "loans read" on public.loans for select to authenticated
  using (public.is_staff());

create policy "loans insert" on public.loans for insert to authenticated
  with check (
    public.is_staff()
    and (
      not public.is_cabin_scoped()
      or exists (
        select 1 from public.devices d
        where d.id = device_id and d.cabin = public.staff_cabin()
      )
    )
  );

create policy "loans update" on public.loans for update to authenticated
  using (
    public.is_staff()
    and (
      not public.is_cabin_scoped()
      or exists (
        select 1 from public.devices d
        where d.id = device_id and d.cabin = public.staff_cabin()
      )
    )
  )
  with check (
    public.is_staff()
    and (
      not public.is_cabin_scoped()
      or exists (
        select 1 from public.devices d
        where d.id = device_id and d.cabin = public.staff_cabin()
      )
    )
  );

create policy "loans delete" on public.loans for delete to authenticated
  using (public.is_admin());

commit;

-- ------------------------------------------------------------
-- 6. VERIFY — expect the six custodians, each with a cabin.
-- ------------------------------------------------------------
--   select email, cabin, is_admin from public.staff order by cabin, email;
--
-- A cabin laptop with no cabin recorded is invisible to nobody but also
-- lendable by nobody but full staff. Expect 0 once the cabin CSV is imported:
--   select count(*) from public.devices where lnb is not null and cabin is null;
