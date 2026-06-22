-- Study AI Companion — flashcards + key concepts (AI study aids).
-- Apply after 0001_study_schema.sql.

-- AI-generated key concepts stored on the material.
alter table public.materials
  add column if not exists key_concepts jsonb not null default '[]'::jsonb;

-- flashcards ------------------------------------------------------------------
create table if not exists public.flashcards (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  material_id uuid not null references public.materials (id) on delete cascade,
  subject_id  uuid not null references public.subjects (id) on delete cascade,
  front       text not null,
  back        text not null,
  created_at  timestamptz not null default now()
);
create index if not exists flashcards_user_id_idx on public.flashcards (user_id);
create index if not exists flashcards_material_id_idx on public.flashcards (material_id);

alter table public.flashcards enable row level security;

drop policy if exists "flashcards_owner" on public.flashcards;
create policy "flashcards_owner" on public.flashcards
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
