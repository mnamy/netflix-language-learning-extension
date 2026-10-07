import { supabase } from "./supabase";
import { patchForManualStatus } from "./reviewSchedule";

const COLUMNS =
  "id, word, translation, source_language, source, learning_status, created_at, times_seen, last_seen_at, part_of_speech, next_review_at, review_interval_days, successful_reviews";

function requireClient() {
  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }
  return supabase;
}

export async function fetchSavedWords() {
  const { data, error } = await requireClient()
    .from("saved_words")
    .select(COLUMNS)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }
  return data || [];
}

export async function updateLearningStatus(id, learningStatus) {
  const { error } = await requireClient()
    .from("saved_words")
    .update(patchForManualStatus(learningStatus))
    .eq("id", id);

  if (error) {
    throw error;
  }
}

export async function updateReviewProgress(id, patch) {
  const { error } = await requireClient()
    .from("saved_words")
    .update(patch)
    .eq("id", id);

  if (error) {
    throw error;
  }
}

export async function deleteSavedWord(id) {
  const { error } = await requireClient()
    .from("saved_words")
    .delete()
    .eq("id", id);

  if (error) {
    throw error;
  }
}
