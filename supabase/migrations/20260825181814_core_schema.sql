-- Enums
create type public.user_role as enum ('admin', 'teacher');
create type public.lecture_status as enum ('pending', 'transcribing', 'reading_slides', 'building', 'ready', 'failed');

-- Profiles (mirrors auth.users)
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  email text,
  role public.user_role not null default 'teacher',
  created_at timestamptz not null default now()
);

create table public.diplomas (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

create table public.subjects (
  id uuid primary key default gen_random_uuid(),
  diploma_id uuid not null references public.diplomas(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  unique (diploma_id, name)
);

-- Many-to-many: a subject may carry several teachers, a teacher several subjects
create table public.subject_teachers (
  subject_id uuid not null references public.subjects(id) on delete cascade,
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (subject_id, teacher_id)
);

create table public.lectures (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references public.subjects(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete restrict,
  title text not null,
  audio_url text not null,
  audio_file_id text not null,
  audio_file_name text,
  slides_url text not null,
  slides_file_id text not null,
  slides_file_name text,
  status public.lecture_status not null default 'pending',
  transcript text,
  slides_text text,
  document_md text,
  error_message text,
  attempts integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  stage_updated_at timestamptz not null default now()
);

create index lectures_subject_id_idx on public.lectures (subject_id, created_at desc);
create index lectures_stalled_idx on public.lectures (status, stage_updated_at);
create index subject_teachers_teacher_idx on public.subject_teachers (teacher_id);
create index subjects_diploma_idx on public.subjects (diploma_id);
