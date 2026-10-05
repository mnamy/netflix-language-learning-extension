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
  const translation = String((data && data.translation) || "")
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
    "Use the sentence only to disambiguate. Never quote or repeat the sentence.\n" +
    "Return JSON only, no markdown, with keys:\n" +
    "clicked_form, lemma, part_of_speech, translation, display_word.\n\n" +
    "Rules:\n" +
    "- clicked_form: the exact clicked token (accents kept).\n" +
    "- lemma: canonical dictionary headword to SAVE.\n" +
    "- Verbs: Spanish infinitive. hablé→hablar, comiendo→comer.\n" +
    "- If a verb has a clear attached clitic (lo, la, los, las, le, les, me, te, se, nos, os), strip it: sacarlo→sacar, dámelo→dar.\n" +
    "- Nouns: singular lemma. cuentas (noun)→cuenta, perros→perro.\n" +
    "- Keep gendered pairs separate: hermano and hermana stay distinct. Do not map to a shared form.\n" +
    "- fui/fue/era/soy: ser vs ir from sentence context.\n" +
    "- cuenta/cuentas: verb contar vs noun cuenta from sentence context.\n" +
    "- part_of_speech: verb, noun, adjective, adverb, phrase, or other.\n" +
    "- translation: concise English of the LEMMA in this sense, 1-4 words.\n" +
    "- display_word: usually the lemma.\n" +
    "- Do not translate neighboring words.\n\n" +
    "Examples:\n" +
    '{"clicked_form":"hablé","lemma":"hablar","part_of_speech":"verb","translation":"to speak","display_word":"hablar"}\n' +
    '{"clicked_form":"sacarlo","lemma":"sacar","part_of_speech":"verb","translation":"to take out","display_word":"sacar"}\n' +
    '{"clicked_form":"cuentas","lemma":"cuenta","part_of_speech":"noun","translation":"account","display_word":"cuenta"}\n' +
    '{"clicked_form":"hermana","lemma":"hermana","part_of_speech":"noun","translation":"sister","display_word":"hermana"}\n\n' +
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
