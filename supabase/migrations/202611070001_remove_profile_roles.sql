-- Stop requiring application roles. Keep historical values for compatibility.
begin;
create or replace function public.create_skin_scan_profile()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.usuarios(auth_user_id,name,email)
  values(new.id,coalesce(new.raw_user_meta_data->>'name','Usuario'),new.email);
  return new;
end $$;
do $$ begin
  if exists(select 1 from information_schema.columns where table_schema='public' and table_name='usuarios' and column_name='role') then
    alter table public.usuarios alter column role drop not null;
    alter table public.usuarios alter column role drop default;
  end if;
end $$;
commit;
