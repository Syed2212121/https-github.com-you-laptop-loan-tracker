-- ============================================================
-- Al-Taqwa College — Laptop Loan Tracker
-- 0009: Intune and NetSupport DNA device exports
-- Run this in the Supabase SQL editor AFTER 0008_cabin_staff_roles.sql.
-- Safe to run more than once.
-- ============================================================
--
-- Two read-only reference sheets, one row per machine, imported from CSV and
-- shown on Student Devices as collapsible panels beside the laptop we hold.
-- Nothing in the app writes a single row by hand — the importers replace them.
--
-- WHY THERE IS NO FOREIGN KEY TO devices
-- Both exports cover the whole fleet: staff laptops, spares and kiosk PCs that
-- have no row in devices and never will. A references() constraint would reject
-- them, and because the importer upserts in chunks of 500 a single orphan would
-- take 499 good rows down with it. These are sheets that happen to join, not
-- children of devices.
--
-- WHY serial_key IS SEPARATE FROM serial_number
-- devices.serial_number was written through cleanSerial() in src/lib.js, which
-- truncates a full 20-char Lenovo "1s…" barcode to its last 8 characters, drops
-- the stray hyphen from "R9-111BGV", and strips a leading "atitude ". The two
-- consoles export the RAW barcode, so a raw-to-raw match would never meet.
--   serial_key    = cleanSerial(serial) upper-cased — the join column.
--   serial_number = exactly what the console said — the column we display.
-- The normalisation lives in JS (serialKey in src/lib.js) so cleanSerial has
-- one home. A serial corrected directly in SQL will NOT re-key these rows;
-- re-run the importer instead.

begin;

-- ------------------------------------------------------------
-- 1. INTUNE  (sheet: Device_Intune-SIMS)
-- ------------------------------------------------------------
create table if not exists public.device_intune (
  serial_key                text primary key,   -- cleanSerial(serial) upper-cased
  serial_number             text,               -- "Serial number", as exported
  device_name               text,               -- "Device name"
  manufacturer              text,               -- "Manufacturer"
  model                     text,               -- "Model"
  management_name           text,               -- "Management name"
  primary_user_upn          text,               -- "Primary user UPN"
  primary_user_email        text,               -- "Primary user email address"
  primary_user_display_name text,               -- "Primary user display name"
  compliance                text,               -- "Compliance"
  ownership                 text,               -- "Ownership"
  sku_family                text,               -- "SkuFamily"
  join_type                 text,               -- "JoinType"
  imported_at               timestamptz not null default now()
);

comment on table public.device_intune is
  'Intune device export (Device_Intune-SIMS). Read-only reference, refreshed by re-importing the CSV. Not every row has a matching devices row — staff machines live here too.';
comment on column public.device_intune.serial_key is
  'Join key: cleanSerial(serial_number) upper-cased, the same funnel devices.serial_number went through.';

-- ------------------------------------------------------------
-- 2. NETSUPPORT DNA
-- ------------------------------------------------------------
create table if not exists public.device_netsupport (
  serial_key    text primary key,               -- cleanSerial(SerialNumber) upper-cased
  serial_number text,                           -- "SerialNumber", as exported
  device_name   text,                           -- "Device_Name"
  pc_node_id    text,                           -- "PC_NODE_ID"
  device_owner  text,                           -- "Device_Owner"
  department    text,                           -- "Department"
  user_name     text,                           -- "UserName"
  logon_name    text,                           -- "LogonName"
  imported_at   timestamptz not null default now()
);

comment on table public.device_netsupport is
  'NetSupport DNA device export. Read-only reference, refreshed by re-importing the CSV.';

-- PC_NODE_ID is DNA's own identity for a machine. It is not the key here — a
-- row with no serial cannot be joined to a laptop and is dropped at import —
-- but it is indexed so it can be searched on later.
create index if not exists device_netsupport_pc_node_idx
  on public.device_netsupport (pc_node_id);

-- ------------------------------------------------------------
-- 3. ROW LEVEL SECURITY
--
-- Read is FULL STAFF ONLY, not merely is_staff(). 0008 hides the ~1,815
-- student SL laptops from cabin custodians; these rows carry the student's UPN,
-- email and display name right next to their serial, so granting custodians
-- read here would hand back through a side door exactly what 0008 shut off.
-- Custodians look after a cupboard of loan laptops — Intune and DNA are no
-- part of that job.
-- ------------------------------------------------------------
alter table public.device_intune     enable row level security;
alter table public.device_netsupport enable row level security;

drop policy if exists "device_intune read"   on public.device_intune;
drop policy if exists "device_intune insert" on public.device_intune;
drop policy if exists "device_intune update" on public.device_intune;
drop policy if exists "device_intune delete" on public.device_intune;

create policy "device_intune read" on public.device_intune for select to authenticated
  using (public.is_staff() and not public.is_cabin_scoped());

create policy "device_intune insert" on public.device_intune for insert to authenticated
  with check (public.is_staff() and not public.is_cabin_scoped());

create policy "device_intune update" on public.device_intune for update to authenticated
  using      (public.is_staff() and not public.is_cabin_scoped())
  with check (public.is_staff() and not public.is_cabin_scoped());

create policy "device_intune delete" on public.device_intune for delete to authenticated
  using (public.is_admin());

drop policy if exists "device_netsupport read"   on public.device_netsupport;
drop policy if exists "device_netsupport insert" on public.device_netsupport;
drop policy if exists "device_netsupport update" on public.device_netsupport;
drop policy if exists "device_netsupport delete" on public.device_netsupport;

create policy "device_netsupport read" on public.device_netsupport for select to authenticated
  using (public.is_staff() and not public.is_cabin_scoped());

create policy "device_netsupport insert" on public.device_netsupport for insert to authenticated
  with check (public.is_staff() and not public.is_cabin_scoped());

create policy "device_netsupport update" on public.device_netsupport for update to authenticated
  using      (public.is_staff() and not public.is_cabin_scoped())
  with check (public.is_staff() and not public.is_cabin_scoped());

create policy "device_netsupport delete" on public.device_netsupport for delete to authenticated
  using (public.is_admin());

-- RLS is bypassed for table owners; force it so it always applies (see 0004).
alter table public.device_intune     force row level security;
alter table public.device_netsupport force row level security;

-- The anon key ships in the browser bundle and these tables carry student
-- identity, so say so explicitly rather than trusting the default grants.
revoke all on public.device_intune     from anon;
revoke all on public.device_netsupport from anon;
grant select, insert, update, delete on public.device_intune     to authenticated;
grant select, insert, update, delete on public.device_netsupport to authenticated;

commit;

-- ============================================================
-- VERIFY (run separately, after committing)
-- ============================================================
--
-- Policies exist and none of them reads plain `true`:
--   select tablename, policyname, cmd, qual, with_check
--   from pg_policies where schemaname = 'public'
--     and tablename in ('device_intune','device_netsupport')
--   order by tablename, policyname;
--
-- RLS is enabled AND forced:
--   select relname, relrowsecurity, relforcerowsecurity
--   from pg_class where relname in ('device_intune','device_netsupport');
--
-- Match rate against live student laptops — the number that says whether the
-- serial strategy actually works. Expect the large majority matched:
--   select count(*) filter (where i.serial_key is not null) as matched,
--          count(*) as student_laptops
--   from public.devices d
--   left join public.device_intune i on i.serial_key = upper(d.serial_number)
--   where d.assigned_student_id is not null and d.archived = false;
--
-- Intune rows matching no laptop. Expected to be NON-zero — that is the whole
-- reason there is no foreign key. Should be roughly the staff fleet:
--   select count(*) from public.device_intune i
--   left join public.devices d on upper(d.serial_number) = i.serial_key
--   where d.id is null;
