-- Study AI Companion — sync theme + language preferences to the user profile.
-- Apply after 0003_materials_storage.sql.
--
-- `public.profiles` already exists (the app reads it directly for name/avatar).
-- These columns let the chosen theme and language follow the user across devices;
-- the client still keeps a local copy (AsyncStorage) for offline / pre-login use.

alter table public.profiles
  add column if not exists theme text not null default 'system'
    check (theme in ('system', 'light', 'dark'));

alter table public.profiles
  add column if not exists language text not null default 'en'
    check (language in ('en', 'es'));
