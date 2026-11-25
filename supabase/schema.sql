-- =====================================================================
-- RC Go — Supabase schema (run once in Supabase → SQL Editor → New query)
-- Tables, row-level security, state-change functions, storage, realtime.
-- Design rule: clients may INSERT their own rows and READ what they're
-- allowed to see; every status change (accept bid, start trip, approve
-- rider…) goes through a SECURITY DEFINER function that checks who is
-- calling. That closes the "edit someone else's trip" loophole.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------- Profiles (one per auth user) ----------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('customer','keke','bike','vendor','admin')),
  full_name text not null default '',
  phone text,
  avatar_url text,
  -- riders
  kyc_status text not null default 'none' check (kyc_status in ('none','draft','pending','approved','rejected')),
  kyc_reason text,
  online boolean not null default false,
  lat double precision, lng double precision, loc_at timestamptz,
  vehicle jsonb,
  upfront boolean not null default false,
  bank_name text, account_number text, account_name text,
  suspended boolean not null default false,
  created_at timestamptz not null default now()
);

-- Sensitive KYC data lives apart from the profile so only the owner + admins can read it.
create table public.rider_applications (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  docs jsonb not null default '{}'::jsonb,       -- { docKey: "storage/path" }
  step int not null default 0,
  submitted_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles(id),
  updated_at timestamptz not null default now()
);

create table public.vendors (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references public.profiles(id) on delete cascade,
  name text not null,
  type text not null check (type in ('restaurant','supermarket','retail')),
  description text default '',
  phone text,
  lat double precision not null, lng double precision not null,
  landmark text,
  hours text,
  open boolean not null default true,
  upfront boolean not null default false,
  bank_name text, account_number text, account_name text,
  logo_url text,
  suspended boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.vendors(id) on delete cascade,
  name text not null,
  price int not null check (price > 0),
  category text default 'Other',
  description text default '',
  image_url text,
  available boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles(id),
  vendor_id uuid not null references public.vendors(id),
  items jsonb not null,                 -- [{product_id,name,price,qty}] — prices re-checked server-side
  subtotal int not null,
  status text not null default 'placed' check (status in ('placed','preparing','ready','picked_up','delivered','rejected','cancelled')),
  pay text not null check (pay in ('cash','transfer')),
  note text default '',
  dropoff jsonb not null,
  request_id uuid,
  transfer_sent_at timestamptz, transfer_confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  accepted_at timestamptz
);

create table public.requests (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('ride','parcel','order')),
  vehicle text not null check (vehicle in ('keke','bike')),
  customer_id uuid not null references public.profiles(id),
  pickup jsonb not null, dropoff jsonb not null,   -- {lat,lng,label}
  path jsonb, dist_km numeric, mins numeric,
  suggested int not null, offer int not null check (offer > 0),
  pay text not null check (pay in ('cash','transfer')),
  note text default '',
  parcel jsonb,
  order_id uuid references public.orders(id),
  status text not null default 'searching' check (status in ('searching','accepted','arrived','in_progress','completed','cancelled')),
  rider_id uuid references public.profiles(id),
  price int,
  approach jsonb,
  transfer_sent_at timestamptz, transfer_confirmed_at timestamptz,
  rated boolean not null default false,
  created_at timestamptz not null default now(),
  accepted_at timestamptz, arrived_at timestamptz, started_at timestamptz, completed_at timestamptz, cancelled_at timestamptz
);
alter table public.orders add constraint orders_request_fk foreign key (request_id) references public.requests(id);

create table public.bids (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.requests(id) on delete cascade,
  rider_id uuid not null references public.profiles(id),
  price int not null check (price > 0),
  type text not null check (type in ('accept','counter')),
  status text not null default 'open' check (status in ('open','declined','accepted','lost','withdrawn')),
  created_at timestamptz not null default now(),
  unique (request_id, rider_id)
);

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  target_type text not null check (target_type in ('rider','vendor')),
  target_id uuid not null,
  customer_id uuid not null references public.profiles(id),
  request_id uuid not null references public.requests(id),
  stars int not null check (stars between 1 and 5),
  text text default '',
  created_at timestamptz not null default now(),
  unique (customer_id, request_id, target_type)
);

create index on public.requests (status, vehicle);
create index on public.requests (customer_id);
create index on public.requests (rider_id);
create index on public.bids (request_id);
create index on public.orders (vendor_id, status);
create index on public.products (vendor_id);
create index on public.reviews (target_type, target_id);

-- ---------- Helpers ----------
create or replace function public.my_role() returns text language sql stable security definer set search_path = public as
$$ select role from profiles where id = auth.uid() $$;
create or replace function public.is_admin() returns boolean language sql stable security definer set search_path = public as
$$ select coalesce((select role = 'admin' and not suspended from profiles where id = auth.uid()), false) $$;
create or replace function public.is_approved_rider(v text default null) returns boolean language sql stable security definer set search_path = public as
$$ select exists (select 1 from profiles where id = auth.uid() and role in ('keke','bike') and kyc_status = 'approved' and not suspended and (v is null or role = v)) $$;

-- Cross-table checks run as definer so policies on orders/requests don't recurse into each other.
create or replace function public.owns_vendor(p_vendor uuid) returns boolean language sql stable security definer set search_path = public as
$$ select exists (select 1 from vendors where id = p_vendor and owner_id = auth.uid()) $$;
create or replace function public.is_rider_of(p_request uuid) returns boolean language sql stable security definer set search_path = public as
$$ select exists (select 1 from requests where id = p_request and rider_id = auth.uid()) $$;
create or replace function public.is_customer_of(p_request uuid) returns boolean language sql stable security definer set search_path = public as
$$ select exists (select 1 from requests where id = p_request and customer_id = auth.uid()) $$;
create or replace function public.vendor_of_order(p_order uuid) returns boolean language sql stable security definer set search_path = public as
$$ select exists (select 1 from orders o join vendors v on v.id = o.vendor_id where o.id = p_order and v.owner_id = auth.uid()) $$;
create or replace function public.can_review(p_request uuid, p_type text, p_target uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from requests r where r.id = p_request and r.customer_id = auth.uid() and r.status = 'completed'
    and ((p_type = 'rider' and r.rider_id = p_target)
      or (p_type = 'vendor' and exists (select 1 from orders o where o.id = r.order_id and o.vendor_id = p_target)))) $$;

-- Reserved admin numbers: a number listed here becomes admin when it signs up. Invisible to the website API.
create table if not exists public.admin_phones (phone text primary key, note text, created_at timestamptz not null default now());
alter table public.admin_phones enable row level security;
revoke all on public.admin_phones from anon, authenticated;
insert into public.admin_phones (phone, note) values ('2347026754340', 'Owner') on conflict do nothing;

-- New auth user → profile. Role comes from sign-up metadata; nobody can self-assign 'admin'
-- (only numbers pre-listed in admin_phones by the owner become admin).
create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
declare r text := coalesce(new.raw_user_meta_data->>'role', 'customer');
begin
  if r not in ('customer','keke','bike','vendor') then r := 'customer'; end if;
  if exists (select 1 from admin_phones where phone = regexp_replace(coalesce(new.phone, ''), '\D', '', 'g')) then r := 'admin'; end if;
  insert into profiles (id, role, full_name, phone)
  values (new.id, r, coalesce(new.raw_user_meta_data->>'full_name', ''), coalesce(new.phone, new.raw_user_meta_data->>'phone'));
  if r in ('keke','bike') then insert into rider_applications (user_id) values (new.id); end if;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- Users may edit their own profile, but not role / KYC status / suspension.
create or replace function public.guard_profile() returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- auth.uid() is null when you run SQL in the dashboard, so dashboard edits (e.g. making an admin) are allowed.
  -- Trusted server functions (e.g. submit_application) set rcgo.trusted for their own transaction.
  if auth.uid() is not null and not public.is_admin() and coalesce(current_setting('rcgo.trusted', true), '') <> 'on' then
    new.role := old.role; new.kyc_status := old.kyc_status; new.kyc_reason := old.kyc_reason; new.suspended := old.suspended;
    if new.online and (old.role not in ('keke','bike') or old.kyc_status <> 'approved' or old.suspended) then new.online := false; end if;
  end if;
  return new;
end $$;
create trigger profiles_guard before update on public.profiles for each row execute function public.guard_profile();

-- ---------- Row-level security ----------
alter table public.profiles enable row level security;
alter table public.rider_applications enable row level security;
alter table public.vendors enable row level security;
alter table public.products enable row level security;
alter table public.orders enable row level security;
alter table public.requests enable row level security;
alter table public.bids enable row level security;
alter table public.reviews enable row level security;

-- profiles: signed-in users can see names/vehicles/locations/bank details needed for trips; edit only yourself.
create policy profiles_read on public.profiles for select to authenticated using (true);
create policy profiles_update_self on public.profiles for update to authenticated using (id = auth.uid() or public.is_admin());

create policy app_read on public.rider_applications for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy app_write on public.rider_applications for update to authenticated
  using (user_id = auth.uid() and (select kyc_status from profiles where id = auth.uid()) in ('none','draft','rejected'));

create policy vendors_read on public.vendors for select using (not suspended or owner_id = auth.uid() or public.is_admin());
create policy vendors_insert on public.vendors for insert to authenticated with check (owner_id = auth.uid() and public.my_role() = 'vendor');
create policy vendors_update on public.vendors for update to authenticated using (owner_id = auth.uid() or public.is_admin());

create policy products_read on public.products for select using (true);
create policy products_write on public.products for all to authenticated
  using (public.owns_vendor(vendor_id)) with check (public.owns_vendor(vendor_id));

create policy orders_read on public.orders for select to authenticated using (
  customer_id = auth.uid() or public.is_admin() or public.owns_vendor(vendor_id)
  or (request_id is not null and public.is_rider_of(request_id)));

create policy requests_read on public.requests for select to authenticated using (
  customer_id = auth.uid() or rider_id = auth.uid() or public.is_admin()
  or (status = 'searching' and public.is_approved_rider(vehicle))
  or (order_id is not null and public.vendor_of_order(order_id)));
create policy requests_insert on public.requests for insert to authenticated with check (
  customer_id = auth.uid() and status = 'searching' and rider_id is null and public.my_role() = 'customer'
  and (order_id is null or exists (select 1 from orders o where o.id = order_id and o.customer_id = auth.uid())));

create policy bids_read on public.bids for select to authenticated using (
  rider_id = auth.uid() or public.is_admin() or public.is_customer_of(request_id));

create policy reviews_read on public.reviews for select using (true);
create policy reviews_insert on public.reviews for insert to authenticated with check (
  customer_id = auth.uid() and public.can_review(request_id, target_type, target_id));

-- ---------- State-change functions (the only way to change statuses) ----------
create or replace function public.place_order(p_vendor uuid, p_items jsonb, p_pay text, p_note text, p_dropoff jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare v vendors; total int := 0; it jsonb; p products; clean jsonb := '[]'::jsonb; new_id uuid;
begin
  if public.my_role() <> 'customer' then raise exception 'Only customers can order'; end if;
  select * into v from vendors where id = p_vendor and not suspended and open;
  if not found then raise exception 'Store is closed or unavailable'; end if;
  for it in select * from jsonb_array_elements(p_items) loop
    select * into p from products where id = (it->>'product_id')::uuid and vendor_id = p_vendor and available;
    if not found then raise exception 'An item is no longer available'; end if;
    total := total + p.price * greatest(1, (it->>'qty')::int);
    clean := clean || jsonb_build_object('product_id', p.id, 'name', p.name, 'price', p.price, 'qty', greatest(1, (it->>'qty')::int));
  end loop;
  insert into orders (customer_id, vendor_id, items, subtotal, pay, note, dropoff)
  values (auth.uid(), p_vendor, clean, total, case when v.upfront then 'transfer' else p_pay end, coalesce(p_note,''), p_dropoff)
  returning id into new_id;
  return new_id;
end $$;

create or replace function public.link_order_request(p_order uuid, p_request uuid) returns void language plpgsql security definer set search_path = public as $$
begin
  update orders set request_id = p_request where id = p_order and customer_id = auth.uid()
    and exists (select 1 from requests r where r.id = p_request and r.customer_id = auth.uid() and r.order_id = p_order);
end $$;

create or replace function public.place_bid(p_request uuid, p_price int) returns void language plpgsql security definer set search_path = public as $$
declare r requests;
begin
  select * into r from requests where id = p_request for update;
  if r.status <> 'searching' then raise exception 'Request is no longer open'; end if;
  if not public.is_approved_rider(r.vehicle) then raise exception 'Not an approved rider for this request'; end if;
  if p_price < r.offer * 0.8 or p_price > r.offer * 3 then raise exception 'Price out of range'; end if;
  insert into bids (request_id, rider_id, price, type) values (p_request, auth.uid(), p_price, case when p_price > r.offer then 'counter' else 'accept' end)
  on conflict (request_id, rider_id) do update set price = excluded.price, type = excluded.type, status = 'open', created_at = now();
end $$;

create or replace function public.withdraw_bid(p_request uuid) returns void language sql security definer set search_path = public as
$$ update bids set status = 'withdrawn' where request_id = p_request and rider_id = auth.uid() and status = 'open' $$;

create or replace function public.decline_bid(p_request uuid, p_rider uuid) returns void language sql security definer set search_path = public as
$$ update bids b set status = 'declined' from requests r where b.request_id = r.id and r.id = p_request and r.customer_id = auth.uid() and b.rider_id = p_rider and b.status = 'open' $$;

create or replace function public.raise_offer(p_request uuid, p_amount int) returns void language sql security definer set search_path = public as
$$ update requests set offer = offer + least(greatest(p_amount, 0), 2000) where id = p_request and customer_id = auth.uid() and status = 'searching' $$;

create or replace function public.accept_bid(p_request uuid, p_rider uuid, p_approach jsonb) returns void language plpgsql security definer set search_path = public as $$
declare r requests; b bids;
begin
  select * into r from requests where id = p_request and customer_id = auth.uid() for update;
  if not found or r.status <> 'searching' then raise exception 'Request is no longer open'; end if;
  select * into b from bids where request_id = p_request and rider_id = p_rider and status = 'open';
  if not found then raise exception 'That offer is no longer available'; end if;
  if exists (select 1 from requests where rider_id = p_rider and status in ('accepted','arrived','in_progress')) then raise exception 'Rider just took another job'; end if;
  update requests set status = 'accepted', rider_id = p_rider, price = b.price, accepted_at = now(), approach = p_approach where id = p_request;
  update bids set status = case when rider_id = p_rider then 'accepted' else 'lost' end where request_id = p_request and status = 'open';
end $$;

create or replace function public.cancel_request(p_request uuid) returns void language plpgsql security definer set search_path = public as $$
declare r requests;
begin
  select * into r from requests where id = p_request for update;
  if r.customer_id = auth.uid() and r.status in ('searching','accepted','arrived') then
    update requests set status = 'cancelled', cancelled_at = now() where id = p_request;
    update orders set status = 'cancelled' where id = r.order_id and status not in ('delivered','picked_up');
  elsif r.rider_id = auth.uid() and r.status in ('accepted','arrived') then
    -- rider backs out: request goes back to searching, rider's bid is declined
    update requests set status = 'searching', rider_id = null, price = null, approach = null, accepted_at = null where id = p_request;
    update bids set status = case when rider_id = auth.uid() then 'declined' else 'open' end where request_id = p_request and status in ('accepted','lost');
  else raise exception 'Cannot cancel this request'; end if;
end $$;

create or replace function public.rider_step(p_request uuid, p_step text) returns void language plpgsql security definer set search_path = public as $$
declare r requests;
begin
  select * into r from requests where id = p_request and rider_id = auth.uid() for update;
  if not found then raise exception 'Not your job'; end if;
  if p_step = 'arrived' and r.status = 'accepted' then update requests set status = 'arrived', arrived_at = now() where id = p_request;
  elsif p_step = 'start' and r.status = 'arrived' then
    update requests set status = 'in_progress', started_at = now() where id = p_request;
    update orders set status = 'picked_up' where id = r.order_id;
  elsif p_step = 'complete' and r.status = 'in_progress' then
    update requests set status = 'completed', completed_at = now() where id = p_request;
    update orders set status = 'delivered' where id = r.order_id;
  else raise exception 'Invalid step'; end if;
end $$;

create or replace function public.mark_transfer_sent(p_kind text, p_id uuid) returns void language plpgsql security definer set search_path = public as $$
begin
  if p_kind = 'order' then update orders set transfer_sent_at = now() where id = p_id and customer_id = auth.uid();
  else update requests set transfer_sent_at = now() where id = p_id and customer_id = auth.uid(); end if;
end $$;

create or replace function public.confirm_transfer(p_kind text, p_id uuid) returns void language plpgsql security definer set search_path = public as $$
begin
  if p_kind = 'order' then update orders o set transfer_confirmed_at = now() from vendors v where o.id = p_id and v.id = o.vendor_id and v.owner_id = auth.uid();
  else update requests set transfer_confirmed_at = now() where id = p_id and rider_id = auth.uid(); end if;
end $$;

create or replace function public.vendor_order_status(p_order uuid, p_status text) returns void language plpgsql security definer set search_path = public as $$
declare o orders;
begin
  select o2.* into o from orders o2 join vendors v on v.id = o2.vendor_id where o2.id = p_order and v.owner_id = auth.uid() for update;
  if not found then raise exception 'Not your order'; end if;
  if (o.status = 'placed' and p_status in ('preparing','rejected')) or (o.status = 'preparing' and p_status = 'ready') then
    update orders set status = p_status, accepted_at = case when p_status = 'preparing' then now() else accepted_at end where id = p_order;
    if p_status = 'rejected' then update requests set status = 'cancelled', cancelled_at = now() where id = o.request_id and status in ('searching','accepted','arrived'); end if;
  else raise exception 'Invalid status change'; end if;
end $$;

create or replace function public.mark_rated(p_request uuid) returns void language sql security definer set search_path = public as
$$ update requests set rated = true where id = p_request and customer_id = auth.uid() and status = 'completed' $$;

-- KYC autosave: merge on the server so overlapping saves (autosave, uploads, Continue) never overwrite each other.
create or replace function public.save_application(p_patch jsonb default null, p_step int default null) returns void language plpgsql security definer set search_path = public as $$
begin
  if (select kyc_status from profiles where id = auth.uid()) not in ('none','draft','rejected') then raise exception 'Your application is locked while it is under review'; end if;
  update rider_applications set data = case when p_patch is null then data else data || p_patch end,
    step = coalesce(p_step, step), updated_at = now() where user_id = auth.uid();
end $$;
create or replace function public.set_application_doc(p_key text, p_doc jsonb) returns void language plpgsql security definer set search_path = public as $$
begin
  if (select kyc_status from profiles where id = auth.uid()) not in ('none','draft','rejected') then raise exception 'Your application is locked while it is under review'; end if;
  update rider_applications set docs = docs || jsonb_build_object(p_key, p_doc), updated_at = now() where user_id = auth.uid();
end $$;

-- Rider submits KYC for review
create or replace function public.submit_application() returns void language plpgsql security definer set search_path = public as $$
declare a rider_applications;
begin
  select * into a from rider_applications where user_id = auth.uid();
  if not found then raise exception 'No application'; end if;
  perform set_config('rcgo.trusted', 'on', true);  -- lets the profile guard accept this status change
  update profiles set kyc_status = 'pending', kyc_reason = null,
    full_name = coalesce(nullif(a.data->>'fullName',''), full_name),
    vehicle = jsonb_build_object('make', a.data->>'make', 'model', trim(coalesce(a.data->>'make','') || ' ' || coalesce(a.data->>'model','')), 'colour', a.data->>'colour', 'plate', upper(coalesce(a.data->>'plate','—')), 'year', a.data->>'year'),
    bank_name = a.data->>'bankName', account_number = a.data->>'accountNumber', account_name = a.data->>'accountName',
    upfront = coalesce((a.data->>'upfront')::boolean, false)
  where id = auth.uid() and kyc_status in ('none','draft','rejected');
  update rider_applications set submitted_at = now() where user_id = auth.uid();
end $$;

-- Admin decisions
create or replace function public.review_rider(p_user uuid, p_decision text, p_reason text default null) returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  if p_decision = 'approve' then update profiles set kyc_status = 'approved', kyc_reason = null, suspended = false where id = p_user;
  elsif p_decision in ('reject','suspend') then
    if coalesce(length(trim(p_reason)),0) < 5 then raise exception 'Give a reason'; end if;
    update profiles set kyc_status = 'rejected', kyc_reason = p_reason, online = false where id = p_user;
  else raise exception 'Unknown decision'; end if;
  update rider_applications set reviewed_at = now(), reviewed_by = auth.uid() where user_id = p_user;
end $$;

-- ---------- Storage ----------
insert into storage.buckets (id, name, public) values ('kyc', 'kyc', false) on conflict do nothing;      -- licences, IDs: private
insert into storage.buckets (id, name, public) values ('public', 'public', true) on conflict do nothing;  -- logos, product photos

create policy kyc_owner_write on storage.objects for insert to authenticated with check (bucket_id = 'kyc' and (storage.foldername(name))[1] = auth.uid()::text);
create policy kyc_owner_update on storage.objects for update to authenticated using (bucket_id = 'kyc' and (storage.foldername(name))[1] = auth.uid()::text);
create policy kyc_read on storage.objects for select to authenticated using (bucket_id = 'kyc' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));
create policy public_read on storage.objects for select using (bucket_id = 'public');
create policy public_owner_write on storage.objects for insert to authenticated with check (bucket_id = 'public' and (storage.foldername(name))[1] = auth.uid()::text);
create policy public_owner_update on storage.objects for update to authenticated using (bucket_id = 'public' and (storage.foldername(name))[1] = auth.uid()::text);
create policy public_owner_delete on storage.objects for delete to authenticated using (bucket_id = 'public' and (storage.foldername(name))[1] = auth.uid()::text);

-- ---------- Realtime (live offers, trip status, rider location) ----------
alter publication supabase_realtime add table public.requests, public.bids, public.orders, public.profiles,
  public.vendors, public.products, public.reviews, public.rider_applications;

-- ---------- Blog: programmes + live updates (public read, admin write) ----------
create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  kind text not null default 'update' check (kind in ('update','program')),
  title text not null check (length(title) between 3 and 140),
  body text not null default '',
  image_url text,
  pinned boolean not null default false,
  published boolean not null default true,
  starts_at timestamptz,
  venue text,
  author_id uuid references public.profiles(id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.posts enable row level security;
create policy posts_read on public.posts for select using (published or public.is_admin());
create policy posts_admin_write on public.posts for all to authenticated using (public.is_admin()) with check (public.is_admin());
grant select on public.posts to anon, authenticated;
grant insert, update, delete on public.posts to authenticated;
alter publication supabase_realtime add table public.posts;

-- ---------- API access (newer Supabase projects don't auto-grant new tables) ----------
-- Grants decide which operations the API may attempt; row-level security above decides which rows.
grant usage on schema public to anon, authenticated;
grant select on public.vendors, public.products, public.reviews to anon;
grant select on all tables in schema public to authenticated;
grant insert on public.requests, public.reviews, public.vendors, public.products to authenticated;
grant update on public.profiles, public.vendors, public.products to authenticated;  -- applications change only via functions
grant delete on public.products to authenticated;
grant execute on all functions in schema public to authenticated;

-- ---------- Make yourself admin (run AFTER you sign up in the app; replace the phone) ----------
-- update public.profiles set role = 'admin' where phone = '2348012345678';
