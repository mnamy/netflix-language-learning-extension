import { supabase } from "./supabase";

const COLUMNS =
  "id, word, translation, source_language, source, learning_status, created_at, times_seen, last_seen_at, part_of_speech";

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
    .update({ learning_status: learningStatus })
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
