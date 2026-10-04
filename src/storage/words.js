// Local vocabulary store. chrome.storage.local only.
// Never persist subtitle sentences or transcripts.

globalThis.NetflixLanguage = globalThis.NetflixLanguage || {};

(function () {
  const STORAGE_KEY = "savedWords";

  function sameEntry(a, b) {
    return (
      String(a.word || "").normalize("NFC").toLowerCase() ===
        String(b.word || "").normalize("NFC").toLowerCase() &&
      String(a.translation || "").trim().toLowerCase() ===
        String(b.translation || "").trim().toLowerCase()
    );
  }

  function readList() {
    return new Promise(function (resolve) {
      chrome.storage.local.get([STORAGE_KEY], function (result) {
        const list = result && result[STORAGE_KEY];
        resolve(Array.isArray(list) ? list : []);
      });
    });
  }

  function writeList(list) {
    return new Promise(function (resolve, reject) {
      const payload = {};
      payload[STORAGE_KEY] = list;
      chrome.storage.local.set(payload, function () {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        resolve();
      });
    });
  }

  globalThis.NetflixLanguage.saveWord = async function (details) {
    const normalize = globalThis.NetflixLanguage.normalizeClickedWord;
    const word = normalize
      ? normalize(details && details.word)
      : String((details && details.word) || "").trim();
    const translation = String((details && details.translation) || "").trim();
    const source = String((details && details.source) || "netflix");
    const sourceLanguage = String((details && details.sourceLanguage) || "").trim();

    if (!word || !translation) {
      throw new Error("Missing word or translation");
    }

    const list = await readList();
    const incoming = { word: word, translation: translation };
    if (list.some(function (item) { return sameEntry(item, incoming); })) {
      return { saved: true, duplicate: true };
    }

    const record = {
      word: word,
      translation: translation,
      source: source,
      savedAt: Date.now(),
    };
    if (sourceLanguage) {
      record.sourceLanguage = sourceLanguage;
    }

    record.id = "w_" + record.savedAt + "_" + list.length;
    list.push(record);
    await writeList(list);
    return { saved: true, duplicate: false };
  };

  globalThis.NetflixLanguage.listSavedWords = function () {
    return readList();
  };

  globalThis.NetflixLanguage.deleteSavedWord = async function (id) {
    const target = String(id || "");
    if (!target) {
      throw new Error("Missing word id");
    }
    const list = await readList();
    const next = list.filter(function (item) {
      return entryId(item) !== target;
    });
    await writeList(next);
  };

  function entryId(item) {
    if (item && item.id) {
      return String(item.id);
    }
    return [item.word, item.translation, item.savedAt].join("|");
  }

  globalThis.NetflixLanguage.savedWordId = entryId;
})();
