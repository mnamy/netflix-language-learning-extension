// Word parsing for clickable subtitles.
// Latin-script first (Spanish today, French/Italian/etc. later).
// Punctuation is never a vocabulary item. Accents are kept.

globalThis.NetflixLanguage = globalThis.NetflixLanguage || {};

(function () {
  // Letters + combining marks (á, ñ, decomposed accents) + digits.
  // Apostrophes/hyphens only count when they sit inside a word
  // (don't, l'homme, ex-novio).
  const WORD_RE =
    /[\p{L}\p{M}\p{N}]+(?:['’ʼ＇][\p{L}\p{M}\p{N}]+)*(?:-[\p{L}\p{M}\p{N}]+)*/gu;

  function tokenizeSubtitleLine(line) {
    const parts = [];
    let lastIndex = 0;
    WORD_RE.lastIndex = 0;

    let match;
    while ((match = WORD_RE.exec(line)) !== null) {
      if (match.index > lastIndex) {
        parts.push({ type: "text", value: line.slice(lastIndex, match.index) });
      }

      const raw = match[0];
      const word = normalizeClickedWord(raw);
      if (word) {
        parts.push({ type: "word", value: raw, word: word });
      } else {
        parts.push({ type: "text", value: raw });
      }

      lastIndex = match.index + raw.length;
    }

    if (lastIndex < line.length) {
      parts.push({ type: "text", value: line.slice(lastIndex) });
    }

    return parts;
  }

  // Strip wrapping punctuation/quotes/¿¡ so a click stores the word only.
  // "creer," -> "creer"    "¿Dónde?" -> "Dónde"    "don't" -> "don't"
  function normalizeClickedWord(raw) {
    if (raw == null) {
      return "";
    }

    let word = String(raw).normalize("NFC").trim();
    word = word.replace(/^[^\p{L}\p{N}]+/u, "");
    word = word.replace(/[^\p{L}\p{N}]+$/u, "");
    return word;
  }

  globalThis.NetflixLanguage.tokenizeSubtitleLine = tokenizeSubtitleLine;
  globalThis.NetflixLanguage.normalizeClickedWord = normalizeClickedWord;
})();
