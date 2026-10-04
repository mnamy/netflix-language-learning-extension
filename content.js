// Content script entry (Manifest V3).
// Contextual translation goes through src/translation/service.js.
// The subtitle sentence is kept in memory for the request only.
// Do not log, save, or persist the sentence.

console.log("Netflix language extension loaded");

(function () {
  if (window !== window.top) {
    return;
  }

  const NL = globalThis.NetflixLanguage;
  const adapter = NL && NL.netflixAdapter;

  if (!adapter || !adapter.isMatch()) {
    return;
  }

  adapter.hideNativeSubtitles();

  const popup = NL.createTranslationPopup();
  let lastCue = "";
  let translateRequestId = 0;

  function errorText(err) {
    const message = err && err.message ? err.message : "";
    if (/Failed to fetch|NetworkError|Load failed/i.test(message)) {
      return "Translation proxy is not running.";
    }
    return message || "Translation failed";
  }

  function requestTranslation(word, sentence, anchor) {
    const requestId = ++translateRequestId;

    popup.show({
      word: word,
      anchor: anchor,
      source: "netflix",
      onRetry: function () {
        requestTranslation(word, sentence, anchor);
      },
      onSave: function (entry) {
        return NL.saveWord(entry).then(function (result) {
          return NL.pushWordToAccount(entry)
            .then(function (sync) {
              result.synced = Boolean(sync && sync.synced);
              return result;
            })
            .catch(function () {
              result.synced = false;
              return result;
            });
        });
      },
    });

    NL.translateInContext({
      word: word,
      sentence: sentence,
    })
      .then(function (result) {
        if (requestId !== translateRequestId) {
          return;
        }
        popup.setTranslation(result.translation);
      })
      .catch(function (err) {
        if (requestId !== translateRequestId) {
          return;
        }
        popup.setError(errorText(err));
      });
  }

  const overlay = NL.createSubtitleOverlay({
    onWordClick: function (word, anchor) {
      const normalized = NL.normalizeClickedWord(word);
      if (!normalized) {
        return;
      }

      console.log("Netflix language word:", normalized);
      requestTranslation(
        normalized,
        adapter.getLatestSubtitle
          ? adapter.getLatestSubtitle()
          : adapter.getCurrentSubtitle(),
        anchor
      );
    },
  });

  function refresh(text) {
    const next = text || "";
    if (!next) {
      popup.hide();
      lastCue = "";
      overlay.sync("", null);
      return;
    }
    if (next !== lastCue) {
      popup.hide();
      lastCue = next;
    }
    overlay.sync(next, adapter.getSubtitleLayout());
  }

  adapter.onSubtitleChange(refresh);
  window.addEventListener("resize", function () {
    if (lastCue) {
      overlay.sync(lastCue, adapter.getSubtitleLayout());
    }
  });
  document.addEventListener("fullscreenchange", function () {
    if (lastCue) {
      overlay.sync(lastCue, adapter.getSubtitleLayout());
    }
  });
})();
