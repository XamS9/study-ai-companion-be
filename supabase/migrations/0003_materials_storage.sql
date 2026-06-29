-- Study AI Companion — private Storage bucket for study-material files (images, PDFs).
-- Apply after 0002_flashcards.sql (Supabase SQL editor or `supabase db push`).
--
-- The frontend uploads under `<userId>/<file>` (see `uploadMaterialFile` in
-- `study-ai-companion-fe/src/lib/storage.ts`) using the user's JWT, and reads back
-- via short-lived signed URLs. Those calls hit Storage directly (not the Express
-- API), so RLS on `storage.objects` is what enforces per-user isolation here; the
-- backend's service-role key bypasses it.

-- Private bucket (not publicly listable; access only via signed URLs / RLS).
insert into storage.buckets (id, name, public)
values ('materials', 'materials', false)
on conflict (id) do nothing;

-- Owner-scoped access: a row is the user's own when the first path segment equals
-- their auth uid. Covers select (signed URLs), insert (upload), update and delete.
drop policy if exists "materials_owner" on storage.objects;
create policy "materials_owner" on storage.objects
  for all
  using (
    bucket_id = 'materials'
    and auth.uid()::text = (storage.foldername(name))[1]
  )
  with check (
    bucket_id = 'materials'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
