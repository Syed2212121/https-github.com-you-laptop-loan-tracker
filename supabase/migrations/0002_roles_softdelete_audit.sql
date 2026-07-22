-- ============================================================
-- 0002 — Hardening: staff roles, soft-delete, audit fields
-- Run this in the Supabase SQL editor AFTER 0001.
-- Safe to run more than once.
-- ============================================================

-- ------------------------------------------------------------
-- 1. STAFF / ROLES
-- ------------------------------------------------------------
create table if not exists public.staff (
  id         uuid primary key references auth.users(id) on delete cascade,
  email      text,
  is_admin   boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.staff enable row level security;

-- Admin check that bypasses RLS to read the staff table.
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select coalesce((select is_admin from public.staff where id = auth.uid()), false);
$$;

drop policy if exists "staff read"        on public.staff;
drop policy if exists "staff admin write" on public.staff;
create policy "staff read"        on public.staff for select to authenticated using (true);
create policy "staff admin write" on public.staff for all    to authenticated using (public.is_admin()) with check (public.is_admin());

-- ------------------------------------------------------------
-- 2. SOFT DELETE (archive instead of destroy)
-- ------------------------------------------------------------
alter table public.students add column if not exists archived boolean not null default false;
alter table public.devices  add column if not exists archived boolean not null default false;

-- ------------------------------------------------------------
-- 3. AUDIT — who returned / renewed a loan
-- ------------------------------------------------------------
alter table public.loans add column if not exists returned_by uuid references auth.users(id);
alter table public.loans add column if not exists renewed_by  uuid references auth.users(id);

-- ------------------------------------------------------------
-- 4. TIGHTEN POLICIES
-- Everyone signed in can read / add / edit (daily loan work).
-- Only admins can PERMANENTLY delete rows.
-- ------------------------------------------------------------
drop policy if exists "staff full access" on public.students;
drop policy if exists "staff full access" on public.devices;
drop policy if exists "staff full access" on public.loans;

-- students
drop policy if exists "students read"   on public.students;
drop policy if exists "students insert" on public.students;
drop policy if exists "students update" on public.students;
drop policy if exists "students delete" on public.students;
create policy "students read"   on public.students for select to authenticated using (true);
create policy "students insert" on public.students for insert to authenticated with check (true);
create policy "students update" on public.students for update to authenticated using (true) with check (true);
create policy "students delete" on public.students for delete to authenticated using (public.is_admin());

-- devices
drop policy if exists "devices read"   on public.devices;
drop policy if exists "devices insert" on public.devices;
drop policy if exists "devices update" on public.devices;
drop policy if exists "devices delete" on public.devices;
create policy "devices read"   on public.devices for select to authenticated using (true);
create policy "devices insert" on public.devices for insert to authenticated with check (true);
create policy "devices update" on public.devices for update to authenticated using (true) with check (true);
create policy "devices delete" on public.devices for delete to authenticated using (public.is_admin());

-- loans
drop policy if exists "loans read"   on public.loans;
drop policy if exists "loans insert" on public.loans;
drop policy if exists "loans update" on public.loans;
drop policy if exists "loans delete" on public.loans;
create policy "loans read"   on public.loans for select to authenticated using (true);
create policy "loans insert" on public.loans for insert to authenticated with check (true);
create policy "loans update" on public.loans for update to authenticated using (true) with check (true);
create policy "loans delete" on public.loans for delete to authenticated using (public.is_admin());

-- ------------------------------------------------------------
-- 5. MAKE YOURSELF AN ADMIN
-- Replace the email below with YOUR login email, then it's included above.
-- (You can re-run just this block any time to add/promote admins.)
-- ------------------------------------------------------------
insert into public.staff (id, email, is_admin)
select id, email, true
from auth.users
where email = 'REPLACE_WITH_YOUR_EMAIL'
on conflict (id) do update set is_admin = true;
