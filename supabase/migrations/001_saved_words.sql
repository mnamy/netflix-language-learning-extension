-- saved_words: one vocabulary item per row.
-- No subtitle sentences, transcripts, or title metadata.

create table if not exists public.saved_words (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  word text not null,
  translation text not null,
  source_language text,
  source text not null default 'netflix',
  learning_status text not null default 'new'
    check (learning_status in ('new', 'learning', 'learned')),
  created_at timestamptz not null default now()
);

create index if not exists saved_words_user_created_idx
  on public.saved_words (user_id, created_at desc);

-- Same user cannot save the exact same word + translation twice.
create unique index if not exists saved_words_user_word_translation_idx
  on public.saved_words (user_id, lower(word), lower(translation));

alter table public.saved_words enable row level security;

-- Users can only read and write their own rows.
create policy "saved_words_select_own"
  on public.saved_words
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "saved_words_insert_own"
  on public.saved_words
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "saved_words_update_own"
  on public.saved_words
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "saved_words_delete_own"
  on public.saved_words
  for delete
  to authenticated
  using (auth.uid() = user_id);
