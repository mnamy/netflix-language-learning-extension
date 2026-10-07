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

export function shapeLemmaResult(clickedForm, data) {
  const clicked = cleanToken(clickedForm);
  const lemma = cleanToken((data && data.lemma) || clicked) || clicked;
  const display =
    cleanToken((data && data.display_word) || lemma) || lemma;
  const translation = String(
    (data && (data.contextual_translation || data.translation)) || ""
  )
    .replace(/^["'\s]+|["'\s]+$/g, "")
    .split(/\r?\n/)[0]
    .trim();

  if (!clicked || !lemma || !translation) {
    return null;
  }

  return {
    clicked_form: clicked,
    lemma: lemma,
    part_of_speech: allowedPos(data && data.part_of_speech),
    contextual_translation: translation,
    translation: translation,
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
    "The subtitle is the source of meaning. Use it to choose the sense of THIS clicked word in THIS line.\n" +
    "Do not return the most common dictionary gloss of the lemma unless that is actually the meaning here.\n" +
    "Never quote, repeat, or store the sentence in any field.\n" +
    "Return JSON only, no markdown, with keys:\n" +
    "clicked_form, lemma, part_of_speech, contextual_translation, display_word.\n\n" +
    "Steps:\n" +
    "1. Identify the clicked form (accents kept).\n" +
    "2. Determine the lemma (dictionary headword to SAVE).\n" +
    "3. Determine part of speech in this sentence.\n" +
    "4. Translate the clicked word's meaning in this subtitle, not a generic lemma gloss.\n\n" +
    "Rules:\n" +
    "- clicked_form: the exact clicked token.\n" +
    "- lemma: canonical headword. Verbs: infinitive (hablé→hablar, comiendo→comer).\n" +
    "- If a verb has a clear attached clitic (lo, la, los, las, le, les, me, te, se, nos, os), strip it: sacarlo→sacar, dámelo→dar.\n" +
    "- Nouns: singular lemma. cuentas (noun)→cuenta, perros→perro.\n" +
    "- Keep gendered pairs separate: hermano and hermana stay distinct.\n" +
    "- fui/fue/era/soy: ser vs ir from sentence meaning.\n" +
    "- cuenta/cuentas: verb contar vs noun cuenta from sentence meaning.\n" +
    "- part_of_speech: verb, noun, adjective, adverb, phrase, or other.\n" +
    "- contextual_translation: concise English of THIS word in THIS subtitle, 1-6 words.\n" +
    "  A short qualifier is allowed when the sense is not the default dictionary meaning.\n" +
    "  Prefer the contextual sense: time expressions, motion, idioms, light verbs, etc.\n" +
    "- display_word: usually the lemma.\n" +
    "- Do not translate neighboring words.\n\n" +
    "Examples of CONTEXTUAL sense (lemma can stay canonical):\n" +
    "Clicked llevas | Sentence: ¿Llevas mucho? - Veinte minutos...\n" +
    '{"clicked_form":"llevas","lemma":"llevar","part_of_speech":"verb","contextual_translation":"to have been (for a time)","display_word":"llevar"}\n' +
    "Clicked cogió | Sentence: cogió esta carretera\n" +
    '{"clicked_form":"cogió","lemma":"coger","part_of_speech":"verb","contextual_translation":"to take (a road)","display_word":"coger"}\n' +
    "Clicked hablé | Sentence: Ayer hablé con ella.\n" +
    '{"clicked_form":"hablé","lemma":"hablar","part_of_speech":"verb","contextual_translation":"to speak","display_word":"hablar"}\n' +
    "Clicked sacarlo | Sentence: Voy a sacarlo ahora.\n" +
    '{"clicked_form":"sacarlo","lemma":"sacar","part_of_speech":"verb","contextual_translation":"to take out","display_word":"sacar"}\n' +
    "Clicked cuentas | Sentence: Revisa las cuentas del banco.\n" +
    '{"clicked_form":"cuentas","lemma":"cuenta","part_of_speech":"noun","contextual_translation":"account","display_word":"cuenta"}\n' +
    "Clicked hermana | Sentence: Mi hermana llega mañana.\n" +
    '{"clicked_form":"hermana","lemma":"hermana","part_of_speech":"noun","contextual_translation":"sister","display_word":"hermana"}\n\n' +
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
      max_completion_tokens: 256,
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
