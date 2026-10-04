// Talks to Supabase Auth + REST with the user's JWT.
// The anon key is public. Row Level Security enforces user_id.

globalThis.NetflixLanguage = globalThis.NetflixLanguage || {};

(function () {
  const SESSION_KEY = "supabaseSession";

  function config() {
    const pub = globalThis.NetflixLanguage.supabasePublic || {};
    let url = String(pub.url || "").trim().replace(/\/$/, "");
    if (url && !/^https?:\/\//i.test(url)) {
      url = "https://" + url;
    }
    return {
      url: url,
      anonKey: String(pub.anonKey || "").trim(),
    };
  }

  function configured() {
    const cfg = config();
    return Boolean(cfg.url && cfg.anonKey);
  }

  function storageGet(key) {
    return new Promise(function (resolve) {
      chrome.storage.local.get([key], function (result) {
        resolve(result && result[key] ? result[key] : null);
      });
    });
  }

  function storageSet(key, value) {
    return new Promise(function (resolve, reject) {
      const payload = {};
      payload[key] = value;
      chrome.storage.local.set(payload, function () {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        resolve();
      });
    });
  }

  function storageRemove(key) {
    return new Promise(function (resolve) {
      chrome.storage.local.remove([key], resolve);
    });
  }

  async function authFetch(path, body) {
    const cfg = config();
    if (!cfg.url || !cfg.anonKey) {
      throw new Error("Add your Supabase URL and anon key in src/supabase/public-config.js");
    }
    const response = await fetch(cfg.url + path, {
      method: "POST",
      headers: {
        apikey: cfg.anonKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    const data = await response.json().catch(function () {
      return {};
    });
    if (!response.ok) {
      throw new Error(data.error_description || data.msg || data.error || "Auth failed");
    }
    return data;
  }

  function toSession(data) {
    return {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: Math.floor(Date.now() / 1000) + Number(data.expires_in || 3600),
      user: data.user || null,
    };
  }

  async function readSession() {
    return storageGet(SESSION_KEY);
  }

  async function writeSession(session) {
    await storageSet(SESSION_KEY, session);
    return session;
  }

  async function refreshSession(session) {
    const data = await authFetch("/auth/v1/token?grant_type=refresh_token", {
      refresh_token: session.refresh_token,
    });
    return writeSession(toSession(data));
  }

  async function getSession() {
    const session = await readSession();
    if (!session || !session.access_token) {
      return null;
    }
    const soon = Math.floor(Date.now() / 1000) + 60;
    if (session.expires_at && session.expires_at <= soon) {
      try {
        return await refreshSession(session);
      } catch (err) {
        await storageRemove(SESSION_KEY);
        return null;
      }
    }
    return session;
  }

  globalThis.NetflixLanguage.supabaseConfigured = configured;

  globalThis.NetflixLanguage.getAccount = async function () {
    const session = await getSession();
    return session && session.user ? session.user : null;
  };

  globalThis.NetflixLanguage.signInToAccount = async function (email, password) {
    const data = await authFetch("/auth/v1/token?grant_type=password", {
      email: email,
      password: password,
    });
    return writeSession(toSession(data));
  };

  function parseOAuthRedirect(callbackUrl) {
    const parsed = new URL(callbackUrl);
    const hash = new URLSearchParams(parsed.hash.replace(/^#/, ""));
    const query = parsed.searchParams;
    return {
      access_token: hash.get("access_token") || query.get("access_token"),
      refresh_token: hash.get("refresh_token") || query.get("refresh_token"),
      expires_in: hash.get("expires_in") || query.get("expires_in"),
      error: hash.get("error_description") || query.get("error_description"),
    };
  }

  async function fetchUser(accessToken) {
    const cfg = config();
    const response = await fetch(cfg.url + "/auth/v1/user", {
      headers: {
        apikey: cfg.anonKey,
        Authorization: "Bearer " + accessToken,
      },
    });
    const data = await response.json().catch(function () {
      return {};
    });
    if (!response.ok) {
      throw new Error(data.msg || data.error || "Could not load account");
    }
    return data;
  }

  globalThis.NetflixLanguage.signInWithGoogle = function () {
    const cfg = config();
    if (!cfg.url || !cfg.anonKey) {
      return Promise.reject(new Error("Supabase is not configured."));
    }
    if (!chrome.identity || !chrome.identity.launchWebAuthFlow) {
      return Promise.reject(new Error("Google sign-in needs the identity permission."));
    }

    const redirectTo = chrome.identity.getRedirectURL("supabase");
    const authUrl =
      cfg.url +
      "/auth/v1/authorize?provider=google&redirect_to=" +
      encodeURIComponent(redirectTo);

    return new Promise(function (resolve, reject) {
      chrome.identity.launchWebAuthFlow(
        { url: authUrl, interactive: true },
        function (callbackUrl) {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }
          if (!callbackUrl) {
            reject(new Error("Google sign-in was cancelled."));
            return;
          }

          const tokens = parseOAuthRedirect(callbackUrl);
          if (tokens.error) {
            reject(new Error(tokens.error));
            return;
          }
          if (!tokens.access_token) {
            reject(new Error("Google sign-in did not return a session."));
            return;
          }

          fetchUser(tokens.access_token)
            .then(function (user) {
              return writeSession(
                toSession({
                  access_token: tokens.access_token,
                  refresh_token: tokens.refresh_token,
                  expires_in: tokens.expires_in,
                  user: user,
                })
              );
            })
            .then(resolve)
            .catch(reject);
        }
      );
    });
  };

  globalThis.NetflixLanguage.signOutOfAccount = function () {
    return storageRemove(SESSION_KEY);
  };

  // Uploads word + translation only. Never send a subtitle sentence.
  globalThis.NetflixLanguage.pushWordToAccount = async function (details) {
    const session = await getSession();
    if (!session || !session.user || !session.user.id) {
      return { synced: false, reason: "signed-out" };
    }

    const cfg = config();
    const word = String((details && details.word) || "").trim();
    const translation = String((details && details.translation) || "").trim();
    if (!word || !translation) {
      throw new Error("Missing word or translation");
    }

    const row = {
      user_id: session.user.id,
      word: word,
      translation: translation,
      source: "netflix",
    };
    if (details && details.sourceLanguage) {
      row.source_language = String(details.sourceLanguage);
    }

    const response = await fetch(cfg.url + "/rest/v1/saved_words", {
      method: "POST",
      headers: {
        apikey: cfg.anonKey,
        Authorization: "Bearer " + session.access_token,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify(row),
    });

    if (response.status === 409) {
      return { synced: true, duplicate: true };
    }
    if (!response.ok) {
      const data = await response.json().catch(function () {
        return {};
      });
      throw new Error(data.message || data.error || "Could not sync word");
    }
    return { synced: true, duplicate: false };
  };
})();
