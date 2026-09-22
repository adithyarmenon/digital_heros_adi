-- Digital Heroes — full schema (tables, triggers, RLS, storage bucket, seed charities)
-- Run this once in the SQL Editor of a NEW Supabase project.
drop table if exists donations, winners, draws, scores, subscriptions, profiles, charities cascade;
drop function if exists public.handle_new_user() cascade;
drop function if exists public.is_admin() cascade;
drop function if exists public.trim_scores() cascade;

create table charities(
  id uuid primary key default gen_random_uuid(),
  name text not null, description text, tag text, image_url text,
  featured bool default false, events jsonb default '[]', created_at timestamptz default now());

create table profiles(
  id uuid primary key references auth.users on delete cascade,
  name text, email text,
  role text check (role in ('user','admin')) default 'user',
  charity_id uuid references charities on delete set null,
  charity_pct int check (charity_pct between 10 and 100) default 10);

create table subscriptions(
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references profiles on delete cascade,
  plan text check (plan in ('monthly','yearly')),
  status text check (status in ('active','cancelled','lapsed')),
  stripe_customer_id text, stripe_sub_id text, renews_on date);

create table scores(
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles on delete cascade,
  value int not null check (value between 1 and 45),
  played_on date not null,
  unique (user_id, played_on));

create table draws(
  id uuid primary key default gen_random_uuid(),
  month text unique, mode text, numbers int[],
  base_pool numeric, carry_in numeric, carry_out numeric, published_at timestamptz);

create table winners(
  id uuid primary key default gen_random_uuid(),
  draw_id uuid references draws on delete cascade,
  user_id uuid references profiles on delete cascade,
  tier int check (tier in (3,4,5)), amount numeric, proof_url text,
  status text default 'awaiting_proof', payment text default 'pending');

create table donations(
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles on delete cascade,
  charity_id uuid references charities, amount numeric,
  created_at timestamptz default now());

create function public.trim_scores() returns trigger language plpgsql as $$
begin
  delete from scores where user_id = new.user_id and id not in
    (select id from scores where user_id = new.user_id order by played_on desc limit 5);
  return null;
end $$;
create trigger trg_trim after insert on scores for each row execute function public.trim_scores();

create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, name, email)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', split_part(new.email,'@',1)), new.email);
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create function public.is_admin() returns boolean
language sql security definer stable set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'admin');
$$;

do $$ declare t text; begin
  foreach t in array array['profiles','subscriptions','scores','draws','winners','donations','charities'] loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy admin_all_%1$s on %1$I for all using (is_admin()) with check (is_admin())', t);
  end loop;
end $$;

create policy own_profile   on profiles      for select using (auth.uid() = id);
create policy own_profile_u on profiles      for update using (auth.uid() = id);
create policy own_scores    on scores        for all    using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy own_winners   on winners       for select using (auth.uid() = user_id);
create policy own_proof     on winners       for update using (auth.uid() = user_id);
create policy own_subs      on subscriptions for all    using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy own_donations on donations     for all    using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy public_charities on charities  for select using (true);
create policy public_draws     on draws      for select using (true);

revoke update on profiles from authenticated;
grant update (name, charity_id, charity_pct) on profiles to authenticated;

insert into storage.buckets (id, name, public) values ('proofs','proofs',false) on conflict do nothing;
create policy proof_upload on storage.objects for insert to authenticated
  with check (bucket_id='proofs' and (storage.foldername(name))[1] = auth.uid()::text);
create policy proof_read on storage.objects for select to authenticated
  using (bucket_id='proofs' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));

insert into charities (name, description, tag, featured, events) values
 ('Open Doors Education','Books, mentors and school fees for first-generation students.','Education',true,'[{"title":"Charity golf day","date":"2026-10-15"}]'),
 ('Clean Water Collective','Village wells and filtration that give families safe water.','Water',false,'[]'),
 ('Second Innings Sports','Adaptive sports programmes for people recovering from injury.','Sport',false,'[]'),
 ('Kitchen Table Meals','Community kitchens serving hot meals every single day.','Hunger',false,'[]'),
 ('Little Lights Foundation','Paediatric care and play therapy for children in hospital.','Health',false,'[]'),
 ('Green Fairways Trust','Turning golf courses into wetlands and pollinator habitats.','Environment',false,'[]');
