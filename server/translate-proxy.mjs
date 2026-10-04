// Small local proxy so the Chrome extension never holds an API key.
// POST /translate { word, sentence } -> { translation }
// The sentence is used for this request only. It is not logged or stored.

import { createServer } from "node:http";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const serverDir = dirname(fileURLToPath(import.meta.url));
const envPath = join(serverDir, ".env");
loadDotEnv(envPath);

const PORT = Number(process.env.PORT || 8787);
const API_KEY = String(
  process.env.GROQ_API_KEY || process.env.OPENAI_API_KEY || ""
).trim();
const BASE_URL = (
  process.env.GROQ_BASE_URL ||
  process.env.OPENAI_BASE_URL ||
  "https://api.groq.com/openai/v1"
).replace(/\/$/, "");
const MODEL =
  process.env.GROQ_MODEL ||
  process.env.OPENAI_MODEL ||
  "openai/gpt-oss-20b";

console.log("GROQ key loaded: " + (API_KEY.length > 0));
console.log("Groq model: " + MODEL);

function loadDotEnv(path) {
  if (!existsSync(path)) {
    return;
  }
  const text = readFileSync(path, "utf8").replace(/^\uFEFF/, "");
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const withoutExport = trimmed.startsWith("export ")
      ? trimmed.slice(7).trim()
      : trimmed;
    const eq = withoutExport.indexOf("=");
    if (eq < 1) {
      continue;
    }
    const key = withoutExport.slice(0, eq).trim();
    let value = withoutExport.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

function send(res, status, body) {
  const json = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Length": Buffer.byteLength(json),
  });
  res.end(json);
}

function readJson(req) {
  return new Promise(function (resolve, reject) {
    const chunks = [];
    let size = 0;
    req.on("data", function (chunk) {
      size += chunk.length;
      if (size > 8000) {
        reject(new Error("Request too large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", function () {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}"));
      } catch (err) {
        reject(err);
      }
    });
    req.on("error", reject);
  });
}

function cleanGloss(text) {
  return String(text || "")
    .replace(/^["'\s]+|["'\s]+$/g, "")
    .split(/\r?\n/)[0]
    .trim();
}

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

async function translateWord(word, sentence) {
  const prompt =
    "Translate ONLY the clicked word into concise English.\n" +
    "Use the subtitle sentence only to pick the correct sense of that one word.\n" +
    "Do not translate neighboring words. Do not return a phrase or clause from the sentence.\n" +
    "Return a multi-word English gloss only if the clicked item itself is a set phrase.\n" +
    "Reply with 1-4 words, no quotes, no extra explanation.\n" +
    "Verbs: use a short infinitive when that is the natural English equivalent.\n\n" +
    "Examples:\n" +
    "Word: banco | Sentence: Además, si lo saca del banco lo van a rastrear. → bank\n" +
    "Word: sacar | Sentence: Además, si lo saca del banco lo van a rastrear. → withdraw\n" +
    "Word: quedar | Sentence: Podemos quedar mañana. → meet\n" +
    "Word: falta | Sentence: Falta información. → missing\n\n" +
    "Word: " +
    word +
    "\nSentence: " +
    sentence;

  const body = {
    model: MODEL,
    temperature: 0,
    max_completion_tokens: 256,
    reasoning_effort: "low",
    messages: [
      {
        role: "user",
        content: prompt,
      },
    ],
  };

  const response = await fetch(BASE_URL + "/chat/completions", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  let data = {};
  try {
    data = await response.json();
  } catch (err) {
    data = {};
  }

  if (!response.ok) {
    const upstream =
      (data.error && data.error.message) ||
      "Groq HTTP " + response.status;
    console.log("Groq status: " + response.status);
    const err = new Error(upstream);
    err.status = 502;
    throw err;
  }

  const choice = data.choices && data.choices[0];
  const gloss = cleanGloss(messageText(choice && choice.message));
  if (!gloss) {
    throw new Error("Empty translation from Groq");
  }
  return gloss;
}

const server = createServer(async function (req, res) {
  if (req.method === "OPTIONS") {
    send(res, 204, {});
    return;
  }

  if (req.method !== "POST" || req.url !== "/translate") {
    send(res, 404, { error: "Not found" });
    return;
  }

  if (!API_KEY) {
    send(res, 503, {
      error: "Missing GROQ_API_KEY. Copy server/.env.example to server/.env.",
    });
    return;
  }

  let payload;
  try {
    payload = await readJson(req);
  } catch (err) {
    send(res, 400, { error: "Invalid JSON" });
    return;
  }

  const word = String(payload.word || "").trim();
  const sentence = String(payload.sentence || "").trim();
  if (!word || !sentence || word.length > 80 || sentence.length > 500) {
    send(res, 400, { error: "word and sentence are required" });
    return;
  }

  try {
    const translation = await translateWord(word, sentence);
    send(res, 200, { translation: translation });
  } catch (err) {
    // Do not log word or sentence.
    send(res, err.status || 502, {
      error: err.message || "Translation failed",
    });
  }
});

server.listen(PORT, "127.0.0.1", function () {
  console.log("Translation proxy on http://127.0.0.1:" + PORT + " (Groq)");
});
