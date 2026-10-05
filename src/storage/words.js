// Local vocabulary store. Used only while signed out.
// Signed-in users read and write Supabase. Never persist subtitle sentences.

globalThis.NetflixLanguage = globalThis.NetflixLanguage || {};

(function () {
  const STORAGE_KEY = "savedWords";
  const NL = globalThis.NetflixLanguage;

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

  function entryId(item) {
    if (item && item.id) {
      return String(item.id);
    }
    return [item.word, item.translation, item.savedAt].join("|");
  }

  async function saveLocal(entry) {
    const list = await readList();
    const existing = list.find(function (item) {
      return NL.sameWord(item, entry);
    });

    if (existing) {
      existing.translation = NL.pickTranslation(
        existing.translation,
        entry.translation
      );
      existing.times_seen = Number(existing.times_seen || 1) + 1;
      existing.savedAt = Date.now();
      if (entry.sourceLanguage && !existing.sourceLanguage) {
        existing.sourceLanguage = entry.sourceLanguage;
      }
      await writeList(list);
      return { saved: true, duplicate: true, times_seen: existing.times_seen };
    }

    const record = {
      word: entry.word,
      translation: entry.translation,
      source: entry.source,
      savedAt: Date.now(),
      times_seen: 1,
    };
    if (entry.sourceLanguage) {
      record.sourceLanguage = entry.sourceLanguage;
    }
    record.id = "w_" + record.savedAt + "_" + list.length;
    list.push(record);
    await writeList(list);
    return { saved: true, duplicate: false, times_seen: 1 };
  }

  async function signedIn() {
    const token = NL.getAccessToken ? await NL.getAccessToken() : "";
    return Boolean(token);
  }

  NL.listLocalSavedWords = readList;

  NL.clearLocalSavedWords = function () {
    return writeList([]);
  };

  NL.saveWord = async function (details) {
    const entry = NL.prepareVocabEntry(details);
    if (await signedIn()) {
      try {
        if (NL.migrateLocalWordsToAccount) {
          await NL.migrateLocalWordsToAccount();
        }
      } catch (err) {
        // Saving the clicked word still goes to the account.
      }
      return NL.pushWordToAccount(entry);
    }
    return saveLocal(entry);
  };

  NL.listSavedWords = async function () {
    if (await signedIn()) {
      return NL.listAccountWords();
    }
    return readList();
  };

  NL.deleteSavedWord = async function (id) {
    const target = String(id || "");
    if (!target) {
      throw new Error("Missing word id");
    }
    if (await signedIn()) {
      return NL.deleteAccountWord(target);
    }
    const list = await readList();
    await writeList(
      list.filter(function (item) {
        return entryId(item) !== target;
      })
    );
  };

  NL.savedWordId = entryId;
})();
