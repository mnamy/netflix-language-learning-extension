-- Lightweight spaced review. Additive only; does not delete or rewrite vocabulary.

alter table public.saved_words
  add column if not exists next_review_at timestamptz,
  add column if not exists review_interval_days integer not null default 0,
  add column if not exists successful_reviews integer not null default 0;

-- Existing new cards stay new and due now.
update public.saved_words
set
  successful_reviews = 0,
  review_interval_days = 0,
  next_review_at = coalesce(next_review_at, created_at, now())
where learning_status = 'new'
  and next_review_at is null;

-- Existing learning cards stay learning and remain due so they are not hidden.
update public.saved_words
set
  successful_reviews = greatest(successful_reviews, 1),
  review_interval_days = greatest(review_interval_days, 1),
  next_review_at = coalesce(next_review_at, now())
where learning_status = 'learning';

-- Existing mastered cards stay mastered; first maintenance review in 7 days.
update public.saved_words
set
  successful_reviews = greatest(successful_reviews, 3),
  review_interval_days = greatest(review_interval_days, 7),
  next_review_at = coalesce(next_review_at, now() + interval '7 days')
where learning_status = 'mastered';

update public.saved_words
set next_review_at = now()
where next_review_at is null;

alter table public.saved_words
  alter column next_review_at set default now();

alter table public.saved_words
  alter column next_review_at set not null;

create index if not exists saved_words_user_next_review_idx
  on public.saved_words (user_id, next_review_at);
