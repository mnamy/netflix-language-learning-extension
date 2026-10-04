// Public Supabase values only. Never put the service-role key here.
// Copy to public-config.js and use the same URL and anon key as web/.env.local.

globalThis.NetflixLanguage = globalThis.NetflixLanguage || {};

globalThis.NetflixLanguage.supabasePublic = {
  url: "https://your-project.supabase.co",
  anonKey: "your-anon-key",
};
