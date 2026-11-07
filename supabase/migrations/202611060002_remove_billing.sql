-- Apply after 202611060001_supabase_auth.sql. Historical billing rows are preserved.
-- The application no longer reads billing columns or enforces subscription quotas.
begin;
create or replace function public.create_skin_scan_profile()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.usuarios(auth_user_id,name,email,role)
  values(new.id,coalesce(new.raw_user_meta_data->>'name','Usuario'),new.email,'user');
  return new;
end $$;
-- Retain legacy columns for compatibility with existing data, without requiring them.
do $$ begin
  if exists(select 1 from information_schema.columns where table_schema='public' and table_name='usuarios' and column_name='plan') then
    alter table public.usuarios alter column plan drop not null;
    alter table public.usuarios alter column plan drop default;
  end if;
end $$;
commit;
