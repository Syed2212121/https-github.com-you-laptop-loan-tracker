-- ============================================================
-- Al-Taqwa College — Laptop Loan Tracker
-- 0004: device "lnb" asset number + seed 19 loan laptops
-- Run this in the Supabase SQL editor of the LLTS project.
-- ============================================================

-- LNB asset number — how IT staff identify a loan laptop (e.g. "LNB-0166").
alter table public.devices add column if not exists lnb text;

-- One LNB per device (nulls allowed for legacy rows without an LNB yet).
create unique index if not exists devices_lnb_key
  on public.devices (lnb) where lnb is not null;

-- Seed the first batch of loan laptops, all available to go out on loan.
insert into public.devices (lnb, serial_number, status) values
  ('LNB-0166', 'bns66m2', 'available'),
  ('LNB-0167', 'c6z66m2', 'available'),
  ('LNB-0179', '5pm86m2', 'available'),
  ('LNB-0185', '8gs66m2', 'available'),
  ('LNB-0201', 'gms66m2', 'available'),
  ('LNB-0205', 'fc096m2', 'available'),
  ('LNB-0212', 'b9z66m2', 'available'),
  ('LNB-0213', 'hb096m2', 'available'),
  ('LNB-0216', '9zw76m2', 'available'),
  ('LNB-0218', 'h2096m2', 'available'),
  ('LNB-0223', 'gqt86m2', 'available'),
  ('LNB-0224', 'czf46m2', 'available'),
  ('LNB-0230', '8jt86m2', 'available'),
  ('LNB-0233', '49z66m2', 'available'),
  ('LNB-0234', 'byt46m2', 'available'),
  ('LNB-0235', '15096m2', 'available'),
  ('LNB-0236', '6ww76m2', 'available'),
  ('LNB-0237', 'cks66m2', 'available'),
  ('LNB-0238', '16n46m2', 'available')
on conflict (serial_number) do nothing;
