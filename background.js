// Toolbar always opens the study site sign-in page. The web app decides auth.
try {
  importScripts("src/supabase/public-config.js");
} catch (err) {
  // public-config.js is local/gitignored; toolbar still opens the fallback URL.
}

function webAppUrl() {
  const pub =
    (globalThis.NetflixLanguage && globalThis.NetflixLanguage.supabasePublic) || {};
  return String(pub.webAppUrl || "http://localhost:5173").trim().replace(/\/$/, "");
}

chrome.action.onClicked.addListener(function () {
  chrome.tabs.create({
    url: webAppUrl() + "/sign-in",
  });
});
