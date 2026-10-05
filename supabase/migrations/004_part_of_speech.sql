-- Additive only. Does not rewrite or delete saved words.
-- Stores part of speech from translation so the Verbs view can filter.
-- Conjugations are not stored.

alter table public.saved_words
  add column if not exists part_of_speech text;
