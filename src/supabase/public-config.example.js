// Public values only. Never put GROQ_API_KEY or the service-role key here.
// Copy to public-config.js (gitignored).

globalThis.NetflixLanguage = globalThis.NetflixLanguage || {};

globalThis.NetflixLanguage.supabasePublic = {
  url: "https://your-project.supabase.co",
  anonKey: "your-anon-key",
  // Local proxy. Production: https://your-app.vercel.app/api/translate
  translateUrl: "http://127.0.0.1:8787/translate",
  // Local Vite. Production: https://your-app.vercel.app
  webAppUrl: "http://localhost:5173",
};
