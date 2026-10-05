import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const serverDir = dirname(dirname(fileURLToPath(import.meta.url)));

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
    if (!String(process.env[key] || "").trim()) {
      process.env[key] = value;
    }
  }
}

loadDotEnv(join(serverDir, ".env"));

function trimEnv(name) {
  return String(process.env[name] || "").trim();
}

export function env() {
  let supabaseUrl = trimEnv("SUPABASE_URL").replace(/\/$/, "");
  if (supabaseUrl && !/^https?:\/\//i.test(supabaseUrl)) {
    supabaseUrl = "https://" + supabaseUrl;
  }
  return {
    port: Number(process.env.PORT || 8787),
    groqKey: trimEnv("GROQ_API_KEY") || trimEnv("OPENAI_API_KEY"),
    groqBaseUrl: (
      trimEnv("GROQ_BASE_URL") ||
      trimEnv("OPENAI_BASE_URL") ||
      "https://api.groq.com/openai/v1"
    ).replace(/\/$/, ""),
    groqModel:
      trimEnv("GROQ_MODEL") || trimEnv("OPENAI_MODEL") || "openai/gpt-oss-20b",
    supabaseUrl: supabaseUrl,
    supabaseAnonKey: trimEnv("SUPABASE_ANON_KEY"),
    allowedUserId: trimEnv("ALLOWED_USER_ID"),
  };
}
