-- ============================================================
-- Al-Taqwa College — Laptop Loan Tracker
-- Seed the six cabin custodians.  NOT a migration — edit and re-run freely.
-- Run AFTER 0008_cabin_staff_roles.sql.
-- ============================================================
--
-- BEFORE RUNNING: each person must already exist in auth.users, i.e. the
-- account has been created in
--   Dashboard → Authentication → Users → Add user
-- (or they have signed up). This script only grants a cabin to an account
-- that already exists; it cannot create logins.
--
-- Cabin pairings are the ones already hard-coded in src/lib.js:
--   yr3_5  Cabin Year 3–5   Rudi, Leo
--   yr6_7  Cabin Year 6–7   Adil, Lee
--   yr8_9  Cabin Year 8–9   Syed, Nadeem
--
-- EDIT THE SIX EMAILS BELOW, then run.

begin;

with wanted (email, cabin) as (
  values
    ('REPLACE_rudi@al-taqwa.vic.edu.au',   'yr3_5'),
    ('REPLACE_leo@al-taqwa.vic.edu.au',    'yr3_5'),
    ('REPLACE_adil@al-taqwa.vic.edu.au',   'yr6_7'),
    ('REPLACE_lee@al-taqwa.vic.edu.au',    'yr6_7'),
    ('REPLACE_syed@al-taqwa.vic.edu.au',   'yr8_9'),
    ('REPLACE_nadeem@al-taqwa.vic.edu.au', 'yr8_9')
)
insert into public.staff (id, email, cabin, is_admin)
select u.id, u.email, w.cabin, false
from wanted w
join auth.users u on lower(u.email) = lower(w.email)
on conflict (id) do update
  set cabin    = excluded.cabin,
      is_admin = false;

-- Refuse to finish quietly if an email did not match an account: without this
-- a typo leaves that custodian with no access and nothing says so.
do $$
declare
  n int;
begin
  select count(*) into n from public.staff where cabin is not null;
  if n <> 6 then
    raise exception
      'ABORTED: expected 6 cabin staff, found %. An email above probably does not match an account in auth.users — check the spelling, and that the user has been created. No changes were made.', n;
  end if;
  raise notice 'OK: 6 cabin custodians seeded.';
end $$;

commit;

-- ------------------------------------------------------------
-- VERIFY — expect 6 rows, two per cabin, is_admin all false.
-- ------------------------------------------------------------
--   select email, cabin, is_admin from public.staff
--    where cabin is not null order by cabin, email;
