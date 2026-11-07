-- Personal accounts only. Historical patient records are preserved for administrative migration.
begin;
-- Retire browser access to the old patient-management module.
revoke all on public.patients from anon, authenticated;
do $$ declare p record; t text; begin
  foreach t in array array['patients','analyses','analysis_attempts'] loop
    for p in select policyname from pg_policies where schemaname='public' and tablename=t loop
      execute format('drop policy %I on public.%I',p.policyname,t);
    end loop;
  end loop;
end $$;
create policy personal_analysis_read on public.analyses for select to authenticated
using(patient_id is null and client_id in (select id from public.usuarios where auth_user_id=auth.uid()));
create policy personal_attempt_read on public.analysis_attempts for select to authenticated
using(patient_id is null and client_id in (select id from public.usuarios where auth_user_id=auth.uid()));
-- Keep profile creation limited to account identity and name.
create or replace function public.create_skin_scan_profile()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.usuarios(auth_user_id,name,email)
  values(new.id,coalesce(new.raw_user_meta_data->>'name','Usuario'),new.email);
  return new;
end $$;
commit;
