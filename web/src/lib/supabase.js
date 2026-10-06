import { createClient } from "@supabase/supabase-js";

function readSearchAndHash() {
  if (typeof window === "undefined") {
    return { query: new URLSearchParams(), hash: new URLSearchParams() };
  }
  return {
    query: new URLSearchParams(window.location.search),
    hash: new URLSearchParams(window.location.hash.replace(/^#/, "")),
  };
}

function firstParam(query, hash, name) {
  return String(hash.get(name) || query.get(name) || "").trim();
}

// Capture before createClient(), which may strip the OAuth callback from the URL.
const { query, hash } = readSearchAndHash();
export const oauthLanding = {
  code: firstParam(query, hash, "code"),
  accessToken: firstParam(query, hash, "access_token"),
  error: firstParam(query, hash, "error"),
  errorCode: firstParam(query, hash, "error_code"),
  errorDescription: firstParam(query, hash, "error_description"),
};

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase =
  url && anonKey
    ? createClient(url, anonKey, {
        auth: {
          detectSessionInUrl: true,
          persistSession: true,
          flowType: "pkce",
        },
      })
    : null;
