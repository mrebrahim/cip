-- Pin the search_path so the trigger cannot be steered by a caller's setting.
create or replace function public.touch_lecture()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at := now();
  if new.status is distinct from old.status then
    new.stage_updated_at := now();
  end if;
  return new;
end;
$$;

-- These are called by the policies, never by a client, so nothing outside the
-- database needs to reach them over PostgREST.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.is_admin() from public, anon;
revoke execute on function public.has_subject_access(uuid) from public, anon;
