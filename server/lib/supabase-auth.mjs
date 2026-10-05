import { env } from "./env.mjs";

export function readBearerToken(headers) {
  const raw = String(
    (headers && (headers.authorization || headers.Authorization)) || ""
  ).trim();
  const match = raw.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : "";
}

export async function verifySupabaseUser(accessToken) {
  const cfg = env();
  if (!cfg.supabaseUrl || !cfg.supabaseAnonKey) {
    const err = new Error(
      "Missing SUPABASE_URL or SUPABASE_ANON_KEY on the translation server."
    );
    err.status = 503;
    throw err;
  }
  if (!accessToken) {
    return null;
  }

  const response = await fetch(cfg.supabaseUrl + "/auth/v1/user", {
    headers: {
      apikey: cfg.supabaseAnonKey,
      Authorization: "Bearer " + accessToken,
    },
  });
  const data = await response.json().catch(function () {
    return {};
  });
  if (!response.ok || !data || !data.id) {
    return null;
  }
  return { id: data.id };
}
