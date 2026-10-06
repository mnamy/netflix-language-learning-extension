// Opens the study site from the toolbar. Session lives in chrome.storage.
try {
  importScripts("src/supabase/public-config.js");
} catch (err) {
  // public-config.js is local/gitignored; toolbar still opens the fallback URL.
}
try {
  importScripts("src/supabase/client.js");
} catch (err) {
  // Session check falls back to chrome.storage below.
}

function webAppUrl() {
  const pub =
    (globalThis.NetflixLanguage && globalThis.NetflixLanguage.supabasePublic) || {};
  return String(pub.webAppUrl || "http://localhost:5173").trim().replace(/\/$/, "");
}

function openStudySite(signedIn) {
  const base = webAppUrl();
  chrome.tabs.create({
    url: signedIn ? base : base + "/sign-in",
  });
}

function sessionLooksValid(session) {
  if (!session || !session.access_token) {
    return false;
  }
  if (!session.expires_at) {
    return true;
  }
  return Number(session.expires_at) > Math.floor(Date.now() / 1000) + 60;
}

chrome.action.onClicked.addListener(function () {
  const check =
    globalThis.NetflixLanguage && globalThis.NetflixLanguage.getAccessToken
      ? globalThis.NetflixLanguage.getAccessToken()
      : new Promise(function (resolve) {
          chrome.storage.local.get(["supabaseSession"], function (result) {
            resolve(sessionLooksValid(result && result.supabaseSession) ? "1" : "");
          });
        });

  check
    .then(function (token) {
      openStudySite(Boolean(token));
    })
    .catch(function () {
      openStudySite(false);
    });
});
