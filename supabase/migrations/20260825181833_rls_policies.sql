-- SECURITY DEFINER helpers: they bypass RLS internally, which is what keeps the
-- policies below from recursing (a profiles policy that queries profiles, etc.).
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  );
$$;

create or replace function public.has_subject_access(sid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin() or exists (
    select 1 from public.subject_teachers st
    where st.subject_id = sid and st.teacher_id = auth.uid()
  );
$$;

revoke execute on function public.is_admin() from public;
revoke execute on function public.has_subject_access(uuid) from public;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.has_subject_access(uuid) to authenticated;

alter table public.profiles          enable row level security;
alter table public.diplomas          enable row level security;
alter table public.subjects          enable row level security;
alter table public.subject_teachers  enable row level security;
alter table public.lectures          enable row level security;

-- PROFILES ------------------------------------------------------------------
-- A teacher sees themselves. An admin sees everyone (needed to assign teachers).
create policy profiles_select on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.is_admin());

create policy profiles_update_self on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid() and role = (select p.role from public.profiles p where p.id = auth.uid()));

create policy profiles_admin_write on public.profiles
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- DIPLOMAS ------------------------------------------------------------------
-- A teacher sees a diploma only if they hold a subject inside it.
create policy diplomas_select on public.diplomas
  for select to authenticated
  using (
    public.is_admin() or exists (
      select 1 from public.subjects s
      join public.subject_teachers st on st.subject_id = s.id
      where s.diploma_id = diplomas.id and st.teacher_id = auth.uid()
    )
  );

create policy diplomas_admin_write on public.diplomas
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- SUBJECTS ------------------------------------------------------------------
create policy subjects_select on public.subjects
  for select to authenticated
  using (public.has_subject_access(id));

create policy subjects_admin_write on public.subjects
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- SUBJECT_TEACHERS ----------------------------------------------------------
-- A teacher may read their own assignments but never create one: assigning
-- yourself to a subject is admin-only, by design.
create policy subject_teachers_select on public.subject_teachers
  for select to authenticated
  using (teacher_id = auth.uid() or public.is_admin());

create policy subject_teachers_admin_write on public.subject_teachers
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- LECTURES ------------------------------------------------------------------
create policy lectures_select on public.lectures
  for select to authenticated
  using (public.has_subject_access(subject_id));

-- The subject must be one the caller holds, and they cannot forge authorship.
create policy lectures_insert on public.lectures
  for insert to authenticated
  with check (public.has_subject_access(subject_id) and created_by = auth.uid());

create policy lectures_update on public.lectures
  for update to authenticated
  using (public.has_subject_access(subject_id))
  with check (public.has_subject_access(subject_id));

-- Open question 1: a teacher may delete their own lecture; an admin, any.
create policy lectures_delete on public.lectures
  for delete to authenticated
  using (public.is_admin() or (created_by = auth.uid() and public.has_subject_access(subject_id)));
