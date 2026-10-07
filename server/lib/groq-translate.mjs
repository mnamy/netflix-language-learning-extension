import { env } from "./env.mjs";

function messageText(message) {
  if (!message) {
    return "";
  }
  if (typeof message.content === "string") {
    return message.content;
  }
  if (Array.isArray(message.content)) {
    return message.content
      .map(function (part) {
        return typeof part === "string" ? part : part && part.text;
      })
      .filter(Boolean)
      .join(" ");
  }
  return "";
}

function cleanToken(value) {
  return String(value || "")
    .normalize("NFC")
    .replace(/^["'`\s]+|["'`\s]+$/g, "")
    .split(/\s+/)[0]
    .trim();
}

function parseJsonObject(text) {
  const raw = String(text || "").trim();
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) {
    return null;
  }
  try {
    return JSON.parse(raw.slice(start, end + 1));
  } catch (err) {
    return null;
  }
}

function allowedPos(value) {
  const pos = String(value || "").trim().toLowerCase();
  if (
    pos === "verb" ||
    pos === "noun" ||
    pos === "adjective" ||
    pos === "adverb" ||
    pos === "phrase"
  ) {
    return pos;
  }
  return "other";
}

function cleanGloss(value) {
  return String(value || "")
    .replace(/^["'\s]+|["'\s]+$/g, "")
    .split(/\r?\n/)[0]
    .trim();
}

function truthyFlag(value) {
  if (value === true || value === 1) {
    return true;
  }
  const text = String(value || "").trim().toLowerCase();
  return text === "true" || text === "yes" || text === "1";
}

export function shapeLemmaResult(clickedForm, data) {
  const clicked = cleanToken(clickedForm);
  const lemma = cleanToken((data && data.lemma) || clicked) || clicked;
  const display =
    cleanToken((data && data.display_word) || lemma) || lemma;
  const canonical = cleanGloss(
    (data && (data.canonical_translation || data.translation)) || ""
  );
  const contextual = cleanGloss(
    (data &&
      (data.contextual_meaning ||
        data.contextual_translation ||
        data.canonical_translation ||
        data.translation)) ||
      ""
  );
  const translation = canonical || contextual;
  const idiomatic = truthyFlag(data && data.is_idiomatic);
  const idiom = cleanGloss((data && data.idiom_or_expression) || "");

  if (!clicked || !lemma || !translation) {
    return null;
  }

  return {
    clicked_form: clicked,
    lemma: lemma,
    part_of_speech: allowedPos(data && data.part_of_speech),
    canonical_translation: translation,
    contextual_meaning: contextual || translation,
    is_idiomatic: idiomatic,
    idiom_or_expression: idiom,
    translation: translation,
    contextual_translation: contextual || translation,
    display_word: display,
  };
}

export async function translateWord(word, sentence) {
  const cfg = env();
  if (!cfg.groqKey) {
    const err = new Error(
      "Missing GROQ_API_KEY. Copy server/.env.example to server/.env."
    );
    err.status = 503;
    throw err;
  }

  const prompt =
    "You analyze ONE Spanish subtitle token for a vocabulary app.\n" +
    "The subtitle is temporary context only. Never copy, quote, or store the sentence in any field.\n" +
    "Return JSON only, no markdown, with keys:\n" +
    "clicked_form, lemma, part_of_speech, canonical_translation, contextual_meaning, is_idiomatic, idiom_or_expression, display_word.\n\n" +
    "Steps:\n" +
    "1. Identify the clicked form (accents kept).\n" +
    "2. Determine the lemma to SAVE (dictionary headword).\n" +
    "3. Determine part of speech.\n" +
    "4. Check whether the token is part of an idiom or fixed expression BEFORE choosing a literal gloss.\n" +
    "5. Give a canonical study gloss of the lemma (this sense, not this conjugated/negated form).\n" +
    "6. Give how the clicked form is functioning in THIS subtitle.\n\n" +
    "Rules:\n" +
    "- lemma: verbs as infinitive (no me lo / dámelo clitics stripped: sacarlo→sacar).\n" +
    "- Nouns: singular. Keep hermano/hermana distinct.\n" +
    "- canonical_translation: concise dictionary-style English of the LEMMA in the relevant SENSE, 1-8 words.\n" +
    "  Verbs as infinitive: soportar → to tolerate / to stand. NEVER include tense, person, or negation\n" +
    "  (not wouldn't tolerate, not you don't paint, not she took).\n" +
    "  Choose the sense used in this subtitle, not merely the most common dictionary sense.\n" +
    "- contextual_meaning: how THIS clicked form works in this subtitle, 1-12 words. May mention idiom sense.\n" +
    "- is_idiomatic: true if a multiword/fixed expression substantially changes the meaning; else false.\n" +
    "- idiom_or_expression: short citation form of the idiom if is_idiomatic, else empty string. Not the full subtitle.\n" +
    "- display_word: usually the lemma.\n" +
    "- Do not translate neighboring words as the saved gloss.\n\n" +
    "Examples:\n" +
    "Clicked soportaría | Sentence: No soportaría eso.\n" +
    '{"clicked_form":"soportaría","lemma":"soportar","part_of_speech":"verb","canonical_translation":"to tolerate / to stand","contextual_meaning":"would not tolerate","is_idiomatic":false,"idiom_or_expression":"","display_word":"soportar"}\n' +
    "Clicked pintas | Sentence: No pintas nada aquí.\n" +
    '{"clicked_form":"pintas","lemma":"pintar","part_of_speech":"verb","canonical_translation":"to belong / have a role","contextual_meaning":"have no place / no business here","is_idiomatic":true,"idiom_or_expression":"no pintar nada","display_word":"pintar"}\n' +
    "Clicked bote | Sentence: La tienes en el bote.\n" +
    '{"clicked_form":"bote","lemma":"bote","part_of_speech":"noun","canonical_translation":"bucket / container","contextual_meaning":"have wrapped around your finger","is_idiomatic":true,"idiom_or_expression":"tener a alguien en el bote","display_word":"bote"}\n' +
    "Clicked llevas | Sentence: ¿Llevas mucho? - Veinte minutos...\n" +
    '{"clicked_form":"llevas","lemma":"llevar","part_of_speech":"verb","canonical_translation":"to have been (for a time)","contextual_meaning":"have been here/doing this for","is_idiomatic":false,"idiom_or_expression":"","display_word":"llevar"}\n' +
    "Clicked cogió | Sentence: cogió esta carretera\n" +
    '{"clicked_form":"cogió","lemma":"coger","part_of_speech":"verb","canonical_translation":"to take (a road)","contextual_meaning":"took this road","is_idiomatic":false,"idiom_or_expression":"","display_word":"coger"}\n' +
    "Clicked hablé | Sentence: Ayer hablé con ella.\n" +
    '{"clicked_form":"hablé","lemma":"hablar","part_of_speech":"verb","canonical_translation":"to speak","contextual_meaning":"spoke","is_idiomatic":false,"idiom_or_expression":"","display_word":"hablar"}\n\n' +
    "Clicked: " +
    word +
    "\nSentence: " +
    sentence;

  const response = await fetch(cfg.groqBaseUrl + "/chat/completions", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + cfg.groqKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: cfg.groqModel,
      temperature: 0,
      max_completion_tokens: 400,
      reasoning_effort: "low",
      messages: [{ role: "user", content: prompt }],
    }),
  });

  let data = {};
  try {
    data = await response.json();
  } catch (err) {
    data = {};
  }

  if (!response.ok) {
    const upstream =
      (data.error && data.error.message) || "Groq HTTP " + response.status;
    console.log("Groq status: " + response.status);
    const err = new Error(upstream);
    err.status = 502;
    throw err;
  }

  const choice = data.choices && data.choices[0];
  const raw = messageText(choice && choice.message);
  const parsed = parseJsonObject(raw) || { translation: raw, lemma: word };
  const shaped = shapeLemmaResult(word, parsed);
  if (!shaped) {
    throw new Error("Empty translation from Groq");
  }
  return shaped;
}
