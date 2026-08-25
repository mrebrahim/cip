-- A profile row for every auth user the admin creates.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce((new.raw_user_meta_data ->> 'role')::public.user_role, 'teacher')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- stage_updated_at is what the cron safety net reads to spot a stalled lecture,
-- so it must move only when the stage actually changes, not on every write.
create or replace function public.touch_lecture()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  if new.status is distinct from old.status then
    new.stage_updated_at := now();
  end if;
  return new;
end;
$$;

create trigger lectures_touch
  before update on public.lectures
  for each row execute function public.touch_lecture();

insert into public.diplomas (name) values
  ('الصحة النفسية'),
  ('الجنسانية المتكاملة'),
  ('التربية الإيجابية'),
  ('التربية الخاصة')
on conflict (name) do nothing;
