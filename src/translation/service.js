// Translation client. Talks only to our backend. Never put API keys here.
// The user authenticates with their Supabase access token.

globalThis.NetflixLanguage = globalThis.NetflixLanguage || {};

(function () {
  function translateUrl() {
    const pub = globalThis.NetflixLanguage.supabasePublic || {};
    return String(pub.translateUrl || "http://127.0.0.1:8787/translate")
      .trim()
      .replace(/\/$/, "");
  }

  globalThis.NetflixLanguage.translateInContext = async function (details) {
    const word = String((details && details.word) || "").trim();
    const sentence = String((details && details.sentence) || "").trim();

    if (!word || !sentence) {
      throw new Error("Missing word or sentence");
    }

    const getToken = globalThis.NetflixLanguage.getAccessToken;
    const accessToken = getToken ? await getToken() : "";
    if (!accessToken) {
      throw new Error("Sign in to translate words.");
    }

    const response = await fetch(translateUrl(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + accessToken,
      },
      body: JSON.stringify({ word: word, sentence: sentence }),
    });

    let data = {};
    try {
      data = await response.json();
    } catch (err) {
      data = {};
    }

    const translation = String(
      data.contextual_translation || data.translation || ""
    ).trim();
    if (!response.ok || !translation) {
      throw new Error(data.error || "Translation failed");
    }

    return {
      clicked_form: String(data.clicked_form || word).trim(),
      lemma: String(data.lemma || word).trim(),
      part_of_speech: String(data.part_of_speech || "").trim(),
      contextual_translation: translation,
      translation: translation,
      display_word: String(data.display_word || data.lemma || word).trim(),
    };
  };
})();
