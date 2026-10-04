// Translation client. The extension only talks to our local Groq proxy.
// Swap this module later to change providers. Never put API keys here.

globalThis.NetflixLanguage = globalThis.NetflixLanguage || {};

(function () {
  const PROXY_URL = "http://127.0.0.1:8787";

  globalThis.NetflixLanguage.translateInContext = async function (details) {
    const word = String((details && details.word) || "").trim();
    const sentence = String((details && details.sentence) || "").trim();

    if (!word || !sentence) {
      throw new Error("Missing word or sentence");
    }

    const response = await fetch(PROXY_URL + "/translate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ word: word, sentence: sentence }),
    });

    let data = {};
    try {
      data = await response.json();
    } catch (err) {
      data = {};
    }

    if (!response.ok || !data.translation) {
      throw new Error(data.error || "Translation failed");
    }

    return { translation: String(data.translation).trim() };
  };
})();
