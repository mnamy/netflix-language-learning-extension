import { originAllowed, requestOrigin } from "./cors.mjs";
import { env } from "./env.mjs";
import { translateWord } from "./groq-translate.mjs";
import { readBearerToken, verifySupabaseUser } from "./supabase-auth.mjs";

function pathnameOf(url) {
  const raw = String(url || "/");
  try {
    return new URL(raw, "http://127.0.0.1").pathname;
  } catch (err) {
    return raw.split("?")[0] || "/";
  }
}

export async function handleTranslateRequest(input) {
  const headers = input.headers || {};
  const origin = input.origin || requestOrigin(headers);
  const method = String(input.method || "GET").toUpperCase();
  const path = pathnameOf(input.url || input.path || "/");

  if (origin && !originAllowed(origin)) {
    return { status: 403, body: { error: "Origin not allowed" } };
  }

  if (method === "OPTIONS") {
    return { status: 204, body: {} };
  }

  if (method !== "POST" || (path !== "/translate" && path !== "/api/translate")) {
    return { status: 404, body: { error: "Not found" } };
  }

  const accessToken = readBearerToken(headers);
  if (!accessToken) {
    return { status: 401, body: { error: "Sign in to translate words." } };
  }

  let user;
  try {
    user = await verifySupabaseUser(accessToken);
  } catch (err) {
    return {
      status: err.status || 503,
      body: { error: err.message || "Auth configuration error" },
    };
  }
  if (!user) {
    return { status: 401, body: { error: "Sign in to translate words." } };
  }

  const allowedId = env().allowedUserId;
  if (!allowedId && process.env.VERCEL) {
    return {
      status: 503,
      body: { error: "ALLOWED_USER_ID is not configured." },
    };
  }
  if (allowedId && user.id !== allowedId) {
    return { status: 403, body: { error: "Forbidden" } };
  }

  const payload = input.body && typeof input.body === "object" ? input.body : {};
  const word = String(payload.word || "").trim();
  const sentence = String(payload.sentence || "").trim();
  if (!word || !sentence || word.length > 80 || sentence.length > 500) {
    return { status: 400, body: { error: "word and sentence are required" } };
  }

  try {
    const analysis = await translateWord(word, sentence);
    return { status: 200, body: analysis };
  } catch (err) {
    return {
      status: err.status || 502,
      body: { error: err.message || "Translation failed" },
    };
  }
}
