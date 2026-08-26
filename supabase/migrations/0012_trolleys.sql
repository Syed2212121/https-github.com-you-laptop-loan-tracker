-- ============================================================
-- Al-Taqwa College — Laptop Loan Tracker
-- 0012: trolleys — the physical carts loan laptops live in
-- Run this in the Supabase SQL editor AFTER 0011_netsupport_school.sql.
-- Safe to run more than once.
-- ============================================================
--
-- LLTS_Loan_Cabins_Import.csv has carried a "Trolley" column since the
-- beginning — A to E, sixteen laptops each, with the cart letter baked into
-- the asset tag (LNB-A01 .. LNB-E16). Nothing ever read it: CabinImport takes
-- only LNB and Cabin, so which cart a laptop belongs to has never been
-- recorded anywhere. This is where it goes.
--
-- WHY THIS IS NOT devices.cabin
-- A cabin is one of three staffed cupboards and it is an ACCESS boundary:
-- 0008 scopes a custodian to their own cabin, and the whole student SL fleet
-- is hidden from them on the strength of it. A trolley is a cart on wheels
-- holding sixteen machines. Five carts do not map onto three cupboards, and
-- overloading cabin would quietly change who can see what. They are separate
-- axes, so they get separate columns.
--
-- WHY on delete set null
-- A laptop outlives the cart it happens to sit in. Retiring a trolley must
-- free its sixteen machines, never delete them — cascade here would destroy
-- inventory (and, through loans.device_id, take loan history with it).
--
-- WHY THERE IS NO capacity COLUMN
-- The count staff read is "how many are still in the cart" over "how many
-- belong to it" — 14/16 means two are out with students. Both halves are
-- derived from devices.trolley_id, so a stored capacity would be a second
-- copy of a number the data already knows, free to drift out of step.

begin;

create table if not exists public.trolleys (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  location   text,
  created_at timestamptz not null default now()
);

comment on table public.trolleys is
  'The physical carts loan laptops live in. Independent of devices.cabin, which is an access boundary rather than a place.';
comment on column public.trolleys.location is
  'Free text — where the cart currently is, e.g. "Lab 2". Deliberately not constrained; carts move.';

-- Case-insensitive, so "Trolley A" and "trolley a" cannot both exist.
create unique index if not exists trolleys_name_key on public.trolleys (lower(name));

alter table public.devices
  add column if not exists trolley_id uuid references public.trolleys(id) on delete set null;

comment on column public.devices.trolley_id is
  'Which cart this laptop lives in, or null for loan stock not in a cart. Set from the Trolley tab; no importer writes it.';

create index if not exists devices_trolley_idx on public.devices (trolley_id);

-- ------------------------------------------------------------
-- ROW LEVEL SECURITY
--
-- Same shape as devices in 0008: everybody on staff can look, only full staff
-- can change anything, only an admin can destroy. Custodians read the carts
-- because they already read every LNB laptop (0008) — a trolley row is a name
-- and a place, and carries no student identity to protect.
--
-- devices.trolley_id needs no policy of its own. It rides on the existing
-- devices policies, which already deny a cabin-scoped account every write.
-- ------------------------------------------------------------
alter table public.trolleys enable row level security;

drop policy if exists "trolleys read"   on public.trolleys;
drop policy if exists "trolleys insert" on public.trolleys;
drop policy if exists "trolleys update" on public.trolleys;
drop policy if exists "trolleys delete" on public.trolleys;

create policy "trolleys read" on public.trolleys for select to authenticated
  using (public.is_staff());

create policy "trolleys insert" on public.trolleys for insert to authenticated
  with check (public.is_staff() and not public.is_cabin_scoped());

create policy "trolleys update" on public.trolleys for update to authenticated
  using      (public.is_staff() and not public.is_cabin_scoped())
  with check (public.is_staff() and not public.is_cabin_scoped());

create policy "trolleys delete" on public.trolleys for delete to authenticated
  using (public.is_admin());

-- RLS is bypassed for table owners; force it so it always applies (see 0004).
alter table public.trolleys force row level security;

-- The anon key ships in the browser bundle, so say this explicitly rather
-- than trusting the default grants.
revoke all on public.trolleys from anon;
grant select, insert, update, delete on public.trolleys to authenticated;

commit;

-- ============================================================
-- VERIFY (run separately, after committing)
-- ============================================================
--
-- The table is shaped as expected:
--   select column_name, data_type, is_nullable
--   from information_schema.columns
--   where table_schema = 'public' and table_name = 'trolleys'
--   order by ordinal_position;
--
-- THE IMPORTANT ONE — the foreign key must be SET NULL, not CASCADE.
-- confdeltype: 'n' = set null, 'c' = cascade, 'a' = no action.
-- Anything other than 'n' means deleting a cart destroys sixteen laptops:
--   select conname, confdeltype
--   from pg_constraint
--   where conrelid = 'public.devices'::regclass and conname like '%trolley%';
--
-- Policies exist and none of them reads plain `true`:
--   select policyname, cmd, qual, with_check
--   from pg_policies where schemaname = 'public' and tablename = 'trolleys'
--   order by policyname;
--
-- RLS enabled AND forced:
--   select relname, relrowsecurity, relforcerowsecurity
--   from pg_class where relname = 'trolleys';
--
-- Once staff have filled some carts — still in / total, per cart:
--   select t.name, t.location,
--          count(*) filter (where d.status <> 'on_loan') as still_in,
--          count(d.id)                                   as belongs
--   from public.trolleys t
--   left join public.devices d
--     on d.trolley_id = t.id and d.archived = false
--   group by t.id, t.name, t.location
--   order by t.name;
