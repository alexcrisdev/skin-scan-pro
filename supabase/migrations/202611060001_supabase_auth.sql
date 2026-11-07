-- Run in the Supabase SQL editor after backing up the existing database.
-- Existing accounts need an explicit mapping to new Supabase Auth UUIDs.
begin;
create table if not exists public.usuarios (
  id uuid primary key default gen_random_uuid(),
  name text not null, email text not null
);
alter table public.usuarios add column if not exists auth_user_id uuid unique references auth.users(id);
alter table public.usuarios add column if not exists role text not null default 'user';
alter table public.usuarios add column if not exists created_at timestamptz not null default now();
-- Keep historical identifiers for mapping; remove the old NOT NULL constraint.
do $$ begin
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='usuarios' and column_name='firebase_uid') then
    alter table public.usuarios alter column firebase_uid drop not null;
  end if;
end $$;
create table if not exists public.patients (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.usuarios(id),
  first_name text not null, last_name text not null,
  birth_date date, gender text, notes text,
  created_at timestamptz not null default now()
);
alter table public.patients add column if not exists updated_at timestamptz not null default now();
create table if not exists public.lesion_types (
  id uuid primary key default gen_random_uuid(), name text unique not null, description text not null
);
insert into public.lesion_types(name,description) values
 ('nv','Nevus'),('mel','Melanoma'),('bkl','Queratosis benigna'),
 ('bcc','Carcinoma basocelular'),('akiec','Queratosis actínica'),
 ('vasc','Lesión vascular'),('df','Dermatofibroma') on conflict(name) do nothing;
create table if not exists public.analyses (
  id uuid primary key default gen_random_uuid(), client_id uuid not null references public.usuarios(id),
  patient_id uuid references public.patients(id), lesion_type_id uuid not null references public.lesion_types(id),
  image_url text, confidence numeric not null, prediction_details jsonb not null,
  ai_interpretation text not null default '', analyzed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create table if not exists public.analysis_attempts (
  id uuid primary key default gen_random_uuid(), client_id uuid not null references public.usuarios(id),
  patient_id uuid references public.patients(id), mime text, status text, message text,
  attempted_at timestamptz not null default now()
);
create or replace function public.create_skin_scan_profile()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.usuarios(auth_user_id,name,email,role)
  values(new.id,coalesce(new.raw_user_meta_data->>'name','Usuario'),new.email,'user');
  return new;
end $$;
drop trigger if exists skin_scan_new_user on auth.users;
create trigger skin_scan_new_user after insert on auth.users
for each row execute function public.create_skin_scan_profile();

-- Replace legacy policies: permissive policies otherwise combine with OR.
do $$ declare p record; t text; begin
  foreach t in array array['usuarios','patients','lesion_types','analyses','analysis_attempts'] loop
    execute format('alter table public.%I enable row level security',t);
    for p in select policyname from pg_policies where schemaname='public' and tablename=t loop
      execute format('drop policy %I on public.%I',p.policyname,t);
    end loop;
    execute format('revoke all on public.%I from anon, authenticated',t);
    execute format('grant select on public.%I to authenticated',t);
    execute format('grant all on public.%I to service_role',t);
  end loop;
end $$;
grant update(name) on public.usuarios to authenticated;
create policy profile_read on public.usuarios for select to authenticated using(auth_user_id=auth.uid());
create policy profile_name_update on public.usuarios for update to authenticated using(auth_user_id=auth.uid()) with check(auth_user_id=auth.uid());
create policy lesion_read on public.lesion_types for select to authenticated using(true);
do $$ declare t text; begin
  foreach t in array array['patients','analyses','analysis_attempts'] loop
    execute format('create policy owner_read on public.%I for select to authenticated using (client_id in (select id from public.usuarios where auth_user_id=auth.uid()))',t);
  end loop;
end $$;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('analysis-images','analysis-images',false,10485760,array['image/jpeg','image/png','image/webp'])
on conflict(id) do update set public=false;
drop policy if exists skin_scan_image_upload on storage.objects;
drop policy if exists skin_scan_image_read on storage.objects;
create policy skin_scan_image_upload on storage.objects for insert to authenticated
with check(bucket_id='analysis-images' and (storage.foldername(name))[1]=auth.uid()::text);
create policy skin_scan_image_read on storage.objects for select to authenticated
using(bucket_id='analysis-images' and (storage.foldername(name))[1]=auth.uid()::text);
commit;
