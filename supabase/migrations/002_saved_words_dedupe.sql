-- One card per user per word. Repeat saves bump times_seen.
-- Subtitle text is still not stored.
-- Do not re-run this file if saved_words_user_word_idx already exists.
-- Re-running the DELETE would drop newer duplicate rows.

alter table public.saved_words
  add column if not exists times_seen integer not null default 1;

alter table public.saved_words
  add column if not exists last_seen_at timestamptz not null default now();

delete from public.saved_words as newer
using public.saved_words as older
where newer.user_id = older.user_id
  and lower(newer.word) = lower(older.word)
  and newer.created_at > older.created_at;

drop index if exists saved_words_user_word_translation_idx;

create unique index if not exists saved_words_user_word_idx
  on public.saved_words (user_id, lower(word));
