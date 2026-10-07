// Shared vocabulary rules. Word + translation only — never a subtitle sentence.

globalThis.NetflixLanguage = globalThis.NetflixLanguage || {};

(function () {
  function wordKey(value) {
    return String(value || "").normalize("NFC").trim().toLowerCase();
  }

  function isWeakTranslation(value) {
    const text = String(value || "").trim().toLowerCase();
    return (
      !text ||
      text === "english translation" ||
      text.indexOf("translating") === 0 ||
      text.indexOf("translation failed") === 0 ||
      text.indexOf("translation unavailable") === 0 ||
      text.indexOf("could not") === 0 ||
      text === "no translation returned"
    );
  }

  function pickTranslation(current, incoming) {
    if (isWeakTranslation(current) && !isWeakTranslation(incoming)) {
      return incoming;
    }
    return current || incoming;
  }

  function sameWord(a, b) {
    return wordKey(a && a.word) === wordKey(b && b.word);
  }

  function normalizeWord(raw) {
    const normalize = globalThis.NetflixLanguage.normalizeClickedWord;
    if (normalize) {
      return normalize(raw);
    }
    return String(raw || "").normalize("NFC").trim();
  }

  function prepareVocabEntry(details) {
    const lemma = normalizeWord((details && details.lemma) || (details && details.word));
    const translation = String((details && details.translation) || "").trim();
    const source = String((details && details.source) || "netflix");
    const sourceLanguage = String(
      (details && (details.sourceLanguage || details.source_language)) || "es"
    ).trim();

    if (!lemma || !translation) {
      throw new Error("Missing word or translation");
    }
    if (isWeakTranslation(translation)) {
      throw new Error("Translation is not ready to save");
    }

    return {
      word: lemma,
      translation: translation,
      source: source,
      sourceLanguage: sourceLanguage,
      partOfSpeech: String((details && (details.partOfSpeech || details.part_of_speech)) || "")
        .trim()
        .toLowerCase(),
    };
  }

  function escapeIlike(value) {
    return String(value || "")
      .replace(/\\/g, "\\\\")
      .replace(/%/g, "\\%")
      .replace(/_/g, "\\_");
  }

  function fromAccountRow(row) {
    const created = row && row.created_at ? row.created_at : "";
    const seen = row && row.last_seen_at ? row.last_seen_at : created;
    return {
      id: row && row.id,
      word: row && row.word,
      translation: row && row.translation,
      source: (row && row.source) || "netflix",
      sourceLanguage: (row && row.source_language) || "",
      source_language: (row && row.source_language) || "",
      learning_status: (row && row.learning_status) || "new",
      part_of_speech: (row && row.part_of_speech) || "",
      times_seen: Number((row && row.times_seen) || 1),
      next_review_at: (row && row.next_review_at) || created,
      review_interval_days: Number((row && row.review_interval_days) || 0),
      successful_reviews: Number((row && row.successful_reviews) || 0),
      created_at: created,
      last_seen_at: seen,
      savedAt: seen || created,
    };
  }

  globalThis.NetflixLanguage.wordKey = wordKey;
  globalThis.NetflixLanguage.isWeakTranslation = isWeakTranslation;
  globalThis.NetflixLanguage.pickTranslation = pickTranslation;
  globalThis.NetflixLanguage.sameWord = sameWord;
  globalThis.NetflixLanguage.prepareVocabEntry = prepareVocabEntry;
  globalThis.NetflixLanguage.escapeIlike = escapeIlike;
  globalThis.NetflixLanguage.fromAccountRow = fromAccountRow;
})();
