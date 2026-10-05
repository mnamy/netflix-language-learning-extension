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
      translateUrl: String(pub.translateUrl || "http://127.0.0.1:8787/translate").trim(),
      webAppUrl: String(pub.webAppUrl || "http://localhost:5173").trim().replace(/\/$/, ""),
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

  async function migrateLocalQuietly() {
    if (!globalThis.NetflixLanguage.migrateLocalWordsToAccount) {
      return;
    }
    try {
      await globalThis.NetflixLanguage.migrateLocalWordsToAccount();
    } catch (err) {
      // Keep the signed-in session even if leftover local words fail to upload.
    }
  }

  globalThis.NetflixLanguage.getAccessToken = async function () {
    const session = await getSession();
    return session && session.access_token ? session.access_token : "";
  };

  globalThis.NetflixLanguage.getAccount = async function () {
    const session = await getSession();
    const user = session && session.user ? session.user : null;
    if (user) {
      await migrateLocalQuietly();
    }
    return user;
  };

  globalThis.NetflixLanguage.signInToAccount = async function (email, password) {
    const data = await authFetch("/auth/v1/token?grant_type=password", {
      email: email,
      password: password,
    });
    const session = await writeSession(toSession(data));
    await migrateLocalQuietly();
    return session;
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
            .then(function (session) {
              return migrateLocalQuietly().then(function () {
                return session;
              });
            })
            .then(resolve)
            .catch(reject);
        }
      );
    });
  };

  globalThis.NetflixLanguage.signOutOfAccount = async function () {
    const session = await readSession();
    const cfg = config();
    if (session && session.access_token && cfg.url && cfg.anonKey) {
      try {
        await fetch(cfg.url + "/auth/v1/logout", {
          method: "POST",
          headers: {
            apikey: cfg.anonKey,
            Authorization: "Bearer " + session.access_token,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ scope: "local" }),
        });
      } catch (err) {
        // Still clear the local session if the revoke request fails.
      }
    }
    await storageRemove(SESSION_KEY);
  };

  const ACCOUNT_COLUMNS =
    "id,word,translation,source_language,source,learning_status,created_at,times_seen,last_seen_at,part_of_speech";

  async function accountHeaders() {
    const session = await getSession();
    const cfg = config();
    if (!session || !session.access_token || !session.user || !session.user.id) {
      throw new Error("Sign in to use your word bank.");
    }
    if (!cfg.url || !cfg.anonKey) {
      throw new Error("Add your Supabase URL and anon key in src/supabase/public-config.js");
    }
    return {
      session: session,
      cfg: cfg,
      headers: {
        apikey: cfg.anonKey,
        Authorization: "Bearer " + session.access_token,
        "Content-Type": "application/json",
      },
    };
  }

  async function findAccountWord(headers, cfg, word) {
    const NL = globalThis.NetflixLanguage;
    const pattern = encodeURIComponent(NL.escapeIlike(word));
    const lookup = await fetch(
      cfg.url +
        "/rest/v1/saved_words?select=" +
        ACCOUNT_COLUMNS +
        "&word=ilike." +
        pattern,
      { headers: headers }
    );
    if (!lookup.ok) {
      throw new Error("Could not look up saved word");
    }
    const matches = await lookup.json().catch(function () {
      return [];
    });
    if (!Array.isArray(matches)) {
      return null;
    }
    return (
      matches.find(function (item) {
        return NL.sameWord(item, { word: word });
      }) || null
    );
  }

  async function patchAccountWord(headers, cfg, id, patch) {
    const update = await fetch(
      cfg.url + "/rest/v1/saved_words?id=eq." + encodeURIComponent(id),
      {
        method: "PATCH",
        headers: headers,
        body: JSON.stringify(patch),
      }
    );
    if (!update.ok) {
      throw new Error("Could not update saved word");
    }
  }

  // Word + translation only. Never send a subtitle sentence.
  globalThis.NetflixLanguage.pushWordToAccount = async function (details, options) {
    const NL = globalThis.NetflixLanguage;
    const bumpSeen = !options || options.bumpSeen !== false;
    const entry = NL.prepareVocabEntry(details);
    const auth = await accountHeaders();
    const existing = await findAccountWord(auth.headers, auth.cfg, entry.word);

    if (existing) {
      const translation = NL.pickTranslation(existing.translation, entry.translation);
      const patch = { translation: translation };
      if (entry.partOfSpeech && !existing.part_of_speech) {
        patch.part_of_speech = entry.partOfSpeech;
      }
      if (bumpSeen) {
        patch.times_seen = Number(existing.times_seen || 1) + 1;
        patch.last_seen_at = new Date().toISOString();
      }
      if (bumpSeen || translation !== existing.translation || patch.part_of_speech) {
        await patchAccountWord(auth.headers, auth.cfg, existing.id, patch);
      }
      return {
        saved: true,
        synced: true,
        duplicate: true,
        times_seen: bumpSeen ? patch.times_seen : Number(existing.times_seen || 1),
      };
    }

    const row = {
      user_id: auth.session.user.id,
      word: entry.word,
      translation: entry.translation,
      source: entry.source || "netflix",
      times_seen: 1,
      last_seen_at: new Date().toISOString(),
    };
    if (entry.sourceLanguage) {
      row.source_language = entry.sourceLanguage;
    }
    if (entry.partOfSpeech) {
      row.part_of_speech = entry.partOfSpeech;
    }

    const response = await fetch(auth.cfg.url + "/rest/v1/saved_words", {
      method: "POST",
      headers: Object.assign({ Prefer: "return=minimal" }, auth.headers),
      body: JSON.stringify(row),
    });

    if (response.status === 409) {
      const raced = await findAccountWord(auth.headers, auth.cfg, entry.word);
      if (raced) {
        const translation = NL.pickTranslation(raced.translation, entry.translation);
        const patch = { translation: translation };
        if (entry.partOfSpeech && !raced.part_of_speech) {
          patch.part_of_speech = entry.partOfSpeech;
        }
        if (bumpSeen) {
          patch.times_seen = Number(raced.times_seen || 1) + 1;
          patch.last_seen_at = new Date().toISOString();
        }
        if (bumpSeen || translation !== raced.translation || patch.part_of_speech) {
          await patchAccountWord(auth.headers, auth.cfg, raced.id, patch);
        }
        return {
          saved: true,
          synced: true,
          duplicate: true,
          times_seen: bumpSeen ? patch.times_seen : Number(raced.times_seen || 1),
        };
      }
      return { saved: true, synced: true, duplicate: true };
    }
    if (!response.ok) {
      const data = await response.json().catch(function () {
        return {};
      });
      throw new Error(data.message || data.error || "Could not save word");
    }
    return { saved: true, synced: true, duplicate: false, times_seen: 1 };
  };

  globalThis.NetflixLanguage.listAccountWords = async function () {
    const auth = await accountHeaders();
    const response = await fetch(
      auth.cfg.url +
        "/rest/v1/saved_words?select=" +
        ACCOUNT_COLUMNS +
        "&order=last_seen_at.desc",
      { headers: auth.headers }
    );
    if (!response.ok) {
      throw new Error("Could not load saved words");
    }
    const rows = await response.json().catch(function () {
      return [];
    });
    return Array.isArray(rows)
      ? rows.map(globalThis.NetflixLanguage.fromAccountRow)
      : [];
  };

  globalThis.NetflixLanguage.deleteAccountWord = async function (id) {
    const auth = await accountHeaders();
    const response = await fetch(
      auth.cfg.url + "/rest/v1/saved_words?id=eq." + encodeURIComponent(id),
      { method: "DELETE", headers: auth.headers }
    );
    if (!response.ok) {
      throw new Error("Could not delete word");
    }
  };

  globalThis.NetflixLanguage.migrateLocalWordsToAccount = async function () {
    const readLocal = globalThis.NetflixLanguage.listLocalSavedWords;
    const clearLocal = globalThis.NetflixLanguage.clearLocalSavedWords;
    if (!readLocal || !clearLocal) {
      return { migrated: 0 };
    }
    const local = await readLocal();
    if (!local.length) {
      return { migrated: 0 };
    }
    for (let i = 0; i < local.length; i++) {
      await globalThis.NetflixLanguage.pushWordToAccount(local[i], { bumpSeen: false });
    }
    await clearLocal();
    return { migrated: local.length };
  };
})();

