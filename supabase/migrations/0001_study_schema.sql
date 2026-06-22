-- Study AI Companion — core schema (subjects, materials, question bank, exams).
-- Apply in the Supabase SQL editor or via the Supabase CLI (`supabase db push`).
-- Idempotent enough to re-run during development.
--
-- Auth/profiles already exist (the app reads `public.profiles` directly). All
-- tables below are owned per-user and protected by RLS scoped to auth.uid().
-- The Express backend uses the service-role key (bypasses RLS) and additionally
-- scopes every query by user id; RLS guards any direct client access.

-- gen_random_uuid()
create extension if not exists pgcrypto;

-- updated_at helper -----------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- subjects --------------------------------------------------------------------
create table if not exists public.subjects (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  name        text not null,
  code        text,
  description text,
  color       text not null default 'primary'
                check (color in ('primary', 'accent', 'warning', 'error', 'success')),
  progress    integer not null default 0 check (progress between 0 and 100),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists subjects_user_id_idx on public.subjects (user_id);

-- materials -------------------------------------------------------------------
create table if not exists public.materials (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  subject_id  uuid not null references public.subjects (id) on delete cascade,
  title       text not null,
  type        text not null check (type in ('pdf', 'image', 'note')),
  pages       integer,
  content     text,        -- OCR-extracted or manually entered text
  summary     text,        -- AI-generated summary (nullable)
  file_url    text,        -- Supabase Storage path for the original file (nullable)
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists materials_user_id_idx on public.materials (user_id);
create index if not exists materials_subject_id_idx on public.materials (subject_id);

-- question bank ---------------------------------------------------------------
create table if not exists public.questions (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users (id) on delete cascade,
  subject_id     uuid not null references public.subjects (id) on delete cascade,
  material_id    uuid references public.materials (id) on delete set null,
  prompt         text not null,
  type           text not null check (type in ('multiple_choice', 'true_false')),
  options        jsonb not null default '[]'::jsonb,  -- array of choice strings
  correct_answer text not null,
  created_at     timestamptz not null default now()
);
create index if not exists questions_user_id_idx on public.questions (user_id);
create index if not exists questions_subject_id_idx on public.questions (subject_id);

-- exams -----------------------------------------------------------------------
create table if not exists public.exams (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null references auth.users (id) on delete cascade,
  subject_id           uuid not null references public.subjects (id) on delete cascade,
  name                 text not null,
  date                 timestamptz not null default now(),
  score                integer check (score between 0 and 100),  -- null until taken
  correct_count        integer,
  total_count          integer not null default 0,
  time_elapsed_seconds integer,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create index if not exists exams_user_id_idx on public.exams (user_id);
create index if not exists exams_subject_id_idx on public.exams (subject_id);

-- exam questions (snapshot of the questions in an exam + the answer given) -----
create table if not exists public.exam_questions (
  id             uuid primary key default gen_random_uuid(),
  exam_id        uuid not null references public.exams (id) on delete cascade,
  question_id    uuid references public.questions (id) on delete set null,
  prompt         text not null,
  type           text not null check (type in ('multiple_choice', 'true_false')),
  options        jsonb not null default '[]'::jsonb,
  correct_answer text not null,
  user_answer    text,
  is_correct     boolean,
  position       integer not null default 0
);
create index if not exists exam_questions_exam_id_idx on public.exam_questions (exam_id);

-- updated_at triggers ---------------------------------------------------------
drop trigger if exists set_subjects_updated_at on public.subjects;
create trigger set_subjects_updated_at before update on public.subjects
  for each row execute function public.set_updated_at();

drop trigger if exists set_materials_updated_at on public.materials;
create trigger set_materials_updated_at before update on public.materials
  for each row execute function public.set_updated_at();

drop trigger if exists set_exams_updated_at on public.exams;
create trigger set_exams_updated_at before update on public.exams
  for each row execute function public.set_updated_at();

-- Row Level Security ----------------------------------------------------------
alter table public.subjects       enable row level security;
alter table public.materials      enable row level security;
alter table public.questions      enable row level security;
alter table public.exams          enable row level security;
alter table public.exam_questions enable row level security;

-- Owner-only access for the user-scoped tables.
drop policy if exists "subjects_owner" on public.subjects;
create policy "subjects_owner" on public.subjects
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "materials_owner" on public.materials;
create policy "materials_owner" on public.materials
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "questions_owner" on public.questions;
create policy "questions_owner" on public.questions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "exams_owner" on public.exams;
create policy "exams_owner" on public.exams
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- exam_questions has no user_id; authorize through its parent exam.
drop policy if exists "exam_questions_owner" on public.exam_questions;
create policy "exam_questions_owner" on public.exam_questions
  for all using (
    exists (select 1 from public.exams e where e.id = exam_id and e.user_id = auth.uid())
  ) with check (
    exists (select 1 from public.exams e where e.id = exam_id and e.user_id = auth.uid())
  );
