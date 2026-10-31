-- 004_marketplace_core: roles, stores, per-seller orders, delivery, money, notifications, audit.
-- Conventions: text ids (uuid strings) like the existing tables; new timestamps are timestamptz.
-- Private columns live in side tables (store_private, product_private, order_secrets) so base
-- tables can be granted to anon without leaking anything.

create schema if not exists private;
grant usage on schema private to anon, authenticated, service_role;

-- 2.1 Roles ------------------------------------------------------------------------------
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (role in ('customer', 'merchant', 'admin'));

-- 2.2 Stores -----------------------------------------------------------------------------
create table public.stores (
  id text primary key default gen_random_uuid()::text,
  owner_id uuid unique references auth.users on delete restrict,   -- null only for the official store
  slug text not null unique,
  name text not null check (char_length(name) between 2 and 80),
  tagline text check (char_length(tagline) <= 120),
  about text check (char_length(about) <= 2000),
  logo_url text, cover_url text,
  accent text not null default 'forest',
  categories text[] not null default '{}' check (cardinality(categories) <= 12),
  country text not null default 'NG', state text, city text,
  status text not null default 'draft' check (status in ('draft', 'pending', 'approved', 'rejected', 'suspended')),
  is_official boolean not null default false,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  approved_at timestamptz,
  search tsvector generated always as (to_tsvector('simple', coalesce(name, '') || ' ' || coalesce(tagline, '') || ' ' || coalesce(city, ''))) stored
);
create index stores_search_idx on public.stores using gin (search);
create index stores_status_idx on public.stores(status);

create table public.store_private (
  store_id text primary key references public.stores on delete cascade,
  pickup_address text, phone text,
  status_note text,
  direct_delivery_enabled boolean not null default false,
  delivery_zones jsonb not null default '[]'::jsonb,   -- array of state or city names the seller delivers to
  commission_override numeric check (commission_override is null or (commission_override >= 0 and commission_override <= 60)),
  trusted boolean not null default false
);

create table public.store_applications (
  id text primary key default gen_random_uuid()::text,
  store_id text not null unique references public.stores on delete cascade,
  submitted_at timestamptz,
  reviewed_by uuid references auth.users, reviewed_at timestamptz,
  decision text check (decision in ('approved', 'rejected')),
  reason text,
  business_name text check (char_length(business_name) <= 120),
  id_type text check (char_length(id_type) <= 40),
  id_ref text check (char_length(id_ref) <= 60),               -- stored minimally, admin-only
  bank_name text check (char_length(bank_name) <= 80),
  account_number text check (char_length(account_number) <= 20),
  account_name text check (char_length(account_name) <= 120)
);

create table public.store_plans (
  id text primary key default gen_random_uuid()::text,
  name text not null, price numeric not null check (price >= 0),
  period text not null default 'monthly' check (period = 'monthly'),
  product_limit integer, commission_discount numeric not null default 0 check (commission_discount >= 0),
  features jsonb not null default '[]'::jsonb, active boolean not null default true
);
create table public.store_subscriptions (
  id text primary key default gen_random_uuid()::text,
  store_id text not null unique references public.stores on delete cascade,
  plan_id text references public.store_plans,
  status text not null default 'trialing' check (status in ('trialing', 'active', 'past_due', 'expired', 'cancelled')),
  current_period_start timestamptz not null default now(),
  current_period_end timestamptz not null,
  grace_until timestamptz
);
create table public.store_payments (
  id text primary key default gen_random_uuid()::text,
  store_id text not null references public.stores on delete cascade,
  subscription_id text references public.store_subscriptions,
  amount numeric not null check (amount > 0), currency text not null default 'NGN',
  method text not null check (method in ('paystack', 'bank', 'admin_recorded')),
  reference text, status text not null default 'paid' check (status in ('pending', 'paid', 'failed')),
  paid_at timestamptz default now(), recorded_by uuid references auth.users,
  unique (reference)
);

-- Products --------------------------------------------------------------------------------
alter table public.products add column if not exists store_id text references public.stores on delete restrict;
create table public.product_private (
  product_id text primary key references public.products on delete cascade,
  review_note text, reviewed_by uuid references auth.users, reviewed_at timestamptz,
  compliance_ref text check (char_length(compliance_ref) <= 80)
);
alter table public.products add column if not exists search tsvector
  generated always as (to_tsvector('simple', coalesce(name, '') || ' ' || coalesce(descr, ''))) stored;
create index products_store_status_idx on public.products(store_id, status);
create index products_search_idx on public.products using gin (search);
alter table public.products add constraint products_text_caps check (char_length(name) <= 160 and char_length(coalesce(descr, '')) <= 5000);

-- Orders (parent) ---------------------------------------------------------------------------
-- Pre-payment states stay as the legacy labels the app already uses; the marketplace flow starts at 'paid'.
-- Legacy 'shipped' is kept as an alias of out_for_delivery until Phase 3 retires it.
alter table public.orders add column if not exists route text check (route in ('direct', 'hub'));
alter table public.orders add column if not exists route_reason text;
alter table public.orders add column if not exists delivery_fee numeric not null default 0;
alter table public.orders add column if not exists payment_status text not null default 'awaiting_payment';
alter table public.orders add column if not exists auto_confirm_at timestamptz;
alter table public.orders add constraint orders_status_check check (status in (
  'new', 'awaiting_payment', 'awaiting_transfer', 'payment_reported', 'awaiting_delivery', 'sent',
  'placed', 'paid', 'confirmed', 'preparing', 'ready_for_delivery', 'out_for_delivery', 'shipped',
  'delivered', 'cancelled', 'disputed'));
alter table public.orders add constraint orders_payment_status_check check (payment_status in (
  'awaiting_payment', 'awaiting_transfer', 'payment_reported', 'awaiting_delivery', 'sent', 'paid', 'partially_refunded', 'refunded'));
create table public.order_secrets (
  order_id text primary key references public.orders on delete cascade,
  delivery_code text not null
);

create table public.seller_orders (
  id text primary key default gen_random_uuid()::text,
  order_id text not null references public.orders on delete cascade,
  store_id text not null references public.stores on delete restrict,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected', 'preparing', 'ready', 'handover_pending',
    'at_hub', 'consolidated', 'out_for_delivery', 'delivered', 'cancelled', 'issue')),
  released boolean not null default false,            -- becomes true only when payment is confirmed
  subtotal numeric not null default 0, commission numeric not null default 0, earning numeric not null default 0,
  accept_by timestamptz, rejected_reason text,
  accepted_at timestamptz, ready_at timestamptz, handed_over_at timestamptz, hub_received_at timestamptz,
  hub_check jsonb, delivered_at timestamptz,
  created_at timestamptz not null default now(),
  unique (order_id, store_id)
);
create index seller_orders_store_status_idx on public.seller_orders(store_id, status);
create index seller_orders_order_idx on public.seller_orders(order_id);

create table public.order_items (
  id text primary key default gen_random_uuid()::text,
  order_id text not null references public.orders on delete cascade,
  seller_order_id text references public.seller_orders on delete cascade,
  product_id text references public.products on delete set null,
  store_id text references public.stores on delete restrict,
  name text not null, size text, unit_price numeric not null, qty integer not null check (qty > 0),
  line_total numeric not null
);
-- Commission is not shown to customers, so it lives apart from the item rows they can read.
create table public.order_item_fees (
  order_item_id text primary key references public.order_items on delete cascade,
  commission_rate numeric not null default 0, commission_amount numeric not null default 0
);
create index order_items_order_idx on public.order_items(order_id);
create index order_items_seller_order_idx on public.order_items(seller_order_id);

create table public.deliveries (
  id text primary key default gen_random_uuid()::text,
  order_id text not null unique references public.orders on delete cascade,
  mode text not null check (mode in ('direct', 'hub')),
  courier_name text, courier_phone text, tracking_note text, parcel_label text,
  status text not null default 'pending' check (status in ('pending', 'dispatched', 'delivered', 'failed')),
  dispatched_at timestamptz, delivered_at timestamptz,
  proof text check (proof in ('code_verified', 'customer_confirmed', 'admin_override', 'auto_confirmed'))
);

-- Money ------------------------------------------------------------------------------------
create table public.ledger_entries (
  id bigint generated always as identity primary key,
  store_id text references public.stores,
  order_id text references public.orders, seller_order_id text references public.seller_orders,
  kind text not null check (kind in ('sale', 'commission', 'rental', 'refund', 'payout', 'adjustment')),
  amount numeric not null, currency text not null default 'NGN',
  status text not null default 'pending' check (status in ('pending', 'available', 'paid', 'reversed')),
  note text, created_at timestamptz not null default now()
);
create index ledger_store_idx on public.ledger_entries(store_id, status);
create unique index ledger_sale_once on public.ledger_entries(seller_order_id, kind) where kind in ('sale', 'commission');

create table public.payouts (
  id text primary key default gen_random_uuid()::text,
  store_id text not null references public.stores, amount numeric not null check (amount > 0),
  currency text not null default 'NGN', reference text not null, method text not null default 'bank_transfer',
  paid_at timestamptz not null default now(), recorded_by uuid references auth.users, period text,
  unique (reference)
);
create table public.refunds (
  id text primary key default gen_random_uuid()::text,
  order_id text not null references public.orders, seller_order_id text references public.seller_orders,
  opened_by uuid references auth.users, reason text, amount numeric not null check (amount > 0),
  status text not null default 'requested' check (status in ('requested', 'approved', 'processed', 'rejected')),
  resolution text, resolved_by uuid references auth.users,
  created_at timestamptz not null default now(), resolved_at timestamptz
);
create table public.disputes (
  id text primary key default gen_random_uuid()::text,
  order_id text not null references public.orders, seller_order_id text references public.seller_orders,
  opened_by uuid not null default auth.uid() references auth.users,
  reason text not null check (char_length(reason) between 5 and 1000),
  status text not null default 'open' check (status in ('open', 'investigating', 'resolved', 'rejected')),
  resolution text, resolved_by uuid references auth.users,
  created_at timestamptz not null default now(), resolved_at timestamptz
);

create table public.notifications (
  id text primary key default gen_random_uuid()::text,
  user_id uuid not null references auth.users on delete cascade,
  kind text not null, title text not null, body text, data jsonb not null default '{}'::jsonb,
  read_at timestamptz, created_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications(user_id, created_at desc);

create table public.audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid, action text not null, target_type text, target_id text,
  before jsonb, after jsonb, at timestamptz not null default now()
);

-- Policy knobs (settings rows readable by admin only; hub info is also readable by merchants, see 005).
insert into public.settings(id, data) values
  ('policy', '{"commission_pct": 10, "category_commission": {}, "payout_hold_days": 3, "auto_confirm_days": 5,
               "accept_hours": 24, "dropoff_hours": 48, "trial_days": 30, "grace_days": 3,
               "direct_enabled": true, "auto_approve_trusted": false, "hub_fee": 0, "direct_fee": 0}'::jsonb),
  ('hub', '{"name": "EverNeed Hub", "address": "", "hours": "", "instructions": "", "dropoff_deadline_hours": 48}'::jsonb)
on conflict (id) do nothing;
