-- Simple review statuses: new, learning, mastered.

alter table public.saved_words
  drop constraint if exists saved_words_learning_status_check;

update public.saved_words
set learning_status = 'mastered'
where learning_status = 'learned';

alter table public.saved_words
  add constraint saved_words_learning_status_check
  check (learning_status in ('new', 'learning', 'mastered'));
