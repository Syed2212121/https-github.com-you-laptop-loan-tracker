-- ============================================================
-- Al-Taqwa College — Laptop Loan Tracker
-- 0011: devices.netsupport_school — the one flag staff set by hand
-- Run this in the Supabase SQL editor AFTER 0010_netsupport_class.sql.
-- Safe to run more than once.
-- ============================================================
--
-- Every other management field this app shows about a laptop is a mirror of
-- somebody else's console: device_intune and device_netsupport are replaced
-- wholesale by the importers and nothing in the UI writes a single row. The
-- NetSupport School client publishes no export we can import, so whether a
-- laptop has it is knowledge that lives in IT staff's heads. This column is
-- where they put it — ticked from the Device Class Details tab, one laptop at
-- a time.
--
-- WHY IT LIVES ON devices AND NOT IN A THIRD MIRROR TABLE
-- The mirrors key on serial_key precisely because they cover machines we do
-- not own — staff laptops, kiosks, spares with no devices row (see the note in
-- 0009). This flag is the opposite: it is only ever asked about a laptop that
-- is already in devices, and it is ours to keep. A column on devices means it
-- survives the next DNA export and needs no join to read.
--
-- WHY NOT NULL DEFAULT false RATHER THAN NULLABLE
-- A checkbox has two states, so the column has two. The cost is that "nobody
-- has looked yet" and "looked, and it is not installed" both read as false.
-- That is accepted: this is a worklist staff tick their way through, and an
-- unticked box already means "not confirmed present" in the only place it is
-- shown. Make it nullable only if a genuine third state is ever needed.
--
-- THE IMPORTERS DO NOT TOUCH IT
-- buildDeviceImport (src/lib.js) never puts this key in its payload, and
-- PostgREST's upsert writes only the columns it was given, so re-importing the
-- SIMS holdings export leaves every tick where it was. That is the whole point
-- of storing it here rather than in a sheet that gets replaced.

begin;

alter table public.devices
  add column if not exists netsupport_school boolean not null default false;

comment on column public.devices.netsupport_school is
  'NetSupport School client present, recorded BY HAND on the Device Class Details tab — there is no export to import it from. false means "not ticked", which covers both "not installed" and "not checked yet". Never written by the CSV importers.';

commit;

-- ------------------------------------------------------------
-- ROW LEVEL SECURITY — nothing to do.
--
-- The column inherits the devices policies from 0008_cabin_staff_roles.sql:
-- "devices update" already allows is_staff() AND NOT is_cabin_scoped(), which
-- is exactly the rule wanted here. Full staff tick the box; cabin custodians
-- cannot, and cannot even read the student SL fleet the tab lists.
-- ------------------------------------------------------------

-- ============================================================
-- VERIFY (run separately, after committing)
-- ============================================================
--
-- The column is there, not null, defaulting to false:
--   select column_name, data_type, is_nullable, column_default
--   from information_schema.columns
--   where table_schema = 'public' and table_name = 'devices'
--     and column_name = 'netsupport_school';
--
-- Every laptop starts unticked, so immediately after this migration the count
-- is zero. After staff have worked through a class it should not be:
--   select count(*) filter (where netsupport_school) as ticked, count(*) as total
--   from public.devices where archived = false;
--
-- What has been ticked, newest roster first:
--   select d.host_name, d.serial_number, s.form, s.full_name
--   from public.devices d
--   left join public.students s on s.student_id = d.assigned_student_id
--   where d.netsupport_school
--   order by s.form, s.full_name;
