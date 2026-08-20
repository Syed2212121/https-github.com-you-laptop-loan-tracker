-- ============================================================
-- Al-Taqwa College — Laptop Loan Tracker
-- 0004: restrict all data access to STAFF, not merely "signed in"
-- Run this in the Supabase SQL editor AFTER 0003.
-- Safe to run more than once.
-- ============================================================
--
-- WHY: 0002 granted read/insert/update to any `authenticated` user
-- (`using (true)`). Because the anon key is public by design, anyone who can
-- obtain a Supabase account on this project could read every student record.
-- This migration requires membership in public.staff instead.
--
-- BEFORE RUNNING: also disable public signup —
--   Dashboard → Authentication → Sign In / Providers → "Allow new users to sign up" = OFF
-- This migration hardens the database; that setting closes the front door.
-- ============================================================

begin;

-- ------------------------------------------------------------
-- 1. SEED STAFF  ← EDIT THIS BEFORE RUNNING
-- Every person who should use the app must exist in public.staff.
-- Add each staff login email to the list below. Existing rows are left alone,
-- except that listed emails are (re-)granted admin.
-- ------------------------------------------------------------
insert into public.staff (id, email, is_admin)
select u.id, u.email, true
from auth.users u
where u.email in (
  'atcadmin@altaqwa.com'      -- e.g. 'syed.takhi@al-taqwa.vic.edu.au'
  -- , 'second.admin@al-taqwa.vic.edu.au'
)
on conflict (id) do update set is_admin = true;

-- Non-admin staff (can do daily loan work, cannot permanently delete):
-- insert into public.staff (id, email, is_admin)
-- select u.id, u.email, false from auth.users u
-- where u.email in ('helpdesk@al-taqwa.vic.edu.au')
-- on conflict (id) do nothing;

-- ------------------------------------------------------------
-- 2. LOCKOUT GUARD
-- If public.staff is empty, the policies below would deny everyone —
-- including you. Abort instead, leaving the database untouched.
-- ------------------------------------------------------------
do $$
declare
  n_staff  int;
  n_admin  int;
begin
  select count(*), count(*) filter (where is_admin) into n_staff, n_admin
  from public.staff;

  if n_staff = 0 then
    raise exception
      'ABORTED: public.staff is empty. Fill in section 1 with real staff emails (that already exist in auth.users) and re-run. No changes were made.';
  end if;

  if n_admin = 0 then
    raise exception
      'ABORTED: public.staff has % row(s) but no admin. At least one is_admin = true is required, or nobody can delete records. No changes were made.', n_staff;
  end if;

  raise notice 'staff check OK: % staff row(s), % admin(s).', n_staff, n_admin;
end $$;

-- ------------------------------------------------------------
-- 3. STAFF MEMBERSHIP CHECK
-- security definer so it can read public.staff regardless of that table's
-- own RLS; search_path pinned to defeat search-path attacks (same shape as
-- is_admin() in 0002).
-- ------------------------------------------------------------
create or replace function public.is_staff()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (select 1 from public.staff where id = auth.uid());
$$;

revoke execute on function public.is_staff() from public, anon;
grant  execute on function public.is_staff() to authenticated;

-- Harden the 0002 function the same way (it was granted broadly by default).
revoke execute on function public.is_admin() from public, anon;
grant  execute on function public.is_admin() to authenticated;

-- ------------------------------------------------------------
-- 4. POLICIES — replace "any authenticated user" with "staff only"
-- Read / insert / update : staff
-- Delete                 : admin only (unchanged intent from 0002)
-- ------------------------------------------------------------

-- students
drop policy if exists "students read"   on public.students;
drop policy if exists "students insert" on public.students;
drop policy if exists "students update" on public.students;
drop policy if exists "students delete" on public.students;
create policy "students read"   on public.students for select to authenticated using (public.is_staff());
create policy "students insert" on public.students for insert to authenticated with check (public.is_staff());
create policy "students update" on public.students for update to authenticated using (public.is_staff()) with check (public.is_staff());
create policy "students delete" on public.students for delete to authenticated using (public.is_admin());

-- devices
drop policy if exists "devices read"   on public.devices;
drop policy if exists "devices insert" on public.devices;
drop policy if exists "devices update" on public.devices;
drop policy if exists "devices delete" on public.devices;
create policy "devices read"   on public.devices for select to authenticated using (public.is_staff());
create policy "devices insert" on public.devices for insert to authenticated with check (public.is_staff());
create policy "devices update" on public.devices for update to authenticated using (public.is_staff()) with check (public.is_staff());
create policy "devices delete" on public.devices for delete to authenticated using (public.is_admin());

-- loans
drop policy if exists "loans read"   on public.loans;
drop policy if exists "loans insert" on public.loans;
drop policy if exists "loans update" on public.loans;
drop policy if exists "loans delete" on public.loans;
create policy "loans read"   on public.loans for select to authenticated using (public.is_staff());
create policy "loans insert" on public.loans for insert to authenticated with check (public.is_staff());
create policy "loans update" on public.loans for update to authenticated using (public.is_staff()) with check (public.is_staff());
create policy "loans delete" on public.loans for delete to authenticated using (public.is_admin());

-- staff — 0002 let ANY authenticated user read the staff list (emails).
-- Restrict to staff; writes stay admin-only.
drop policy if exists "staff read"        on public.staff;
drop policy if exists "staff admin write" on public.staff;
create policy "staff read"        on public.staff for select to authenticated using (public.is_staff());
create policy "staff admin write" on public.staff for all    to authenticated using (public.is_admin()) with check (public.is_admin());

-- ------------------------------------------------------------
-- 5. BELT AND BRACES
-- RLS is bypassed for table owners; force it so it always applies.
-- ------------------------------------------------------------
alter table public.students force row level security;
alter table public.devices  force row level security;
alter table public.loans    force row level security;
alter table public.staff    force row level security;

commit;

-- ============================================================
-- VERIFY (run separately after committing)
-- ============================================================
-- Every policy should read is_staff() or is_admin(), never plain `true`:
--
--   select tablename, policyname, cmd, qual, with_check
--   from pg_policies
--   where schemaname = 'public'
--   order by tablename, policyname;
--
-- Who has access:
--
--   select email, is_admin from public.staff order by is_admin desc, email;
-- ============================================================
