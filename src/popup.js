// Translation popup UI. Site-agnostic: no Netflix DOM selectors.
// One popup at a time. Shows word + meaning only — never the sentence.

globalThis.NetflixLanguage = globalThis.NetflixLanguage || {};

(function () {
  const STYLE_ID = "nflx-lang-popup-style";
  const GAP = 12;
  const VIEW_PAD = 16;
  const CONTROL_GUTTER = 108;

  const css = `
    .nflx-lang-popup {
      position: fixed;
      z-index: 2147483647;
      box-sizing: border-box;
      min-width: 220px;
      max-width: 320px;
      padding: 16px 16px 14px;
      border-radius: 14px;
      background: rgba(20, 20, 20, 0.96);
      color: #fff;
      font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
      box-shadow: 0 16px 40px rgba(0, 0, 0, 0.55);
      border: 1px solid rgba(255, 255, 255, 0.1);
      pointer-events: auto;
    }
    .nflx-lang-popup[hidden] {
      display: none !important;
    }
    .nflx-lang-popup:focus {
      outline: none;
    }
    .nflx-lang-popup-close {
      position: absolute;
      top: 8px;
      right: 8px;
      width: 32px;
      height: 32px;
      border: none;
      border-radius: 8px;
      background: transparent;
      color: rgba(255, 255, 255, 0.72);
      font-size: 20px;
      line-height: 1;
      cursor: pointer;
    }
    .nflx-lang-popup-close:hover,
    .nflx-lang-popup-close:focus-visible {
      background: rgba(255, 255, 255, 0.12);
      color: #fff;
    }
    .nflx-lang-popup-close:focus-visible,
    .nflx-lang-popup-retry:focus-visible,
    .nflx-lang-popup-save:focus-visible {
      outline: 2px solid #fff;
      outline-offset: 2px;
    }
    .nflx-lang-popup-word {
      margin: 0 36px 4px 0;
      font-size: 20px;
      font-weight: 700;
      line-height: 1.25;
      word-break: break-word;
    }
    .nflx-lang-popup-lemma {
      margin: 0 36px 8px 0;
      font-size: 12px;
      font-weight: 500;
      color: rgba(255, 255, 255, 0.5);
    }
    .nflx-lang-popup-lemma[hidden] {
      display: none !important;
    }
    .nflx-lang-popup-context {
      margin: 0 0 12px;
      font-size: 13px;
      line-height: 1.4;
      color: rgba(255, 255, 255, 0.62);
    }
    .nflx-lang-popup-context[hidden] {
      display: none !important;
    }
    .nflx-lang-popup-status {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      margin: 0 0 12px;
      font-size: 14px;
      line-height: 1.4;
      color: rgba(255, 255, 255, 0.74);
      min-height: 1.4em;
    }
    .nflx-lang-popup-status.is-loading {
      color: rgba(255, 255, 255, 0.5);
    }
    .nflx-lang-popup-status.is-error {
      color: #ffb4ab;
    }
    .nflx-lang-popup-spinner {
      flex: 0 0 auto;
      width: 12px;
      height: 12px;
      margin-top: 4px;
      border: 2px solid rgba(255, 255, 255, 0.2);
      border-top-color: #fff;
      border-radius: 50%;
      animation: nflx-lang-spin 0.7s linear infinite;
    }
    .nflx-lang-popup-spinner[hidden] {
      display: none !important;
    }
    @keyframes nflx-lang-spin {
      to { transform: rotate(360deg); }
    }
    .nflx-lang-popup-actions {
      display: flex;
      gap: 8px;
    }
    .nflx-lang-popup-retry,
    .nflx-lang-popup-save {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 36px;
      padding: 0 14px;
      border: none;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 650;
      cursor: pointer;
    }
    .nflx-lang-popup-retry {
      flex: 0 0 auto;
      background: rgba(255, 255, 255, 0.1);
      color: #fff;
    }
    .nflx-lang-popup-retry:hover,
    .nflx-lang-popup-retry:focus-visible {
      background: rgba(255, 255, 255, 0.16);
    }
    .nflx-lang-popup-retry[hidden] {
      display: none !important;
    }
    .nflx-lang-popup-save {
      flex: 1 1 auto;
      width: 100%;
      background: #e50914;
      color: #fff;
    }
    .nflx-lang-popup-save:hover:not(:disabled),
    .nflx-lang-popup-save:focus-visible:not(:disabled) {
      background: #f6121d;
    }
    .nflx-lang-popup-save:disabled {
      background: rgba(229, 9, 20, 0.35);
      color: rgba(255, 255, 255, 0.45);
      cursor: not-allowed;
    }
    .nflx-lang-popup-save.is-saved,
    .nflx-lang-popup-save.is-saved:disabled {
      background: #2e7d32;
      color: #fff;
      cursor: default;
    }
  `;

  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) {
      return;
    }
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = css;
    document.documentElement.appendChild(style);
  }

  function placePopup(el, anchor) {
    if (!anchor) {
      return;
    }
    const popupRect = el.getBoundingClientRect();
    const wordRect = anchor.getBoundingClientRect();
    const maxLeft = window.innerWidth - popupRect.width - VIEW_PAD;
    const maxTop = window.innerHeight - popupRect.height - CONTROL_GUTTER;

    let left = wordRect.left + wordRect.width / 2 - popupRect.width / 2;
    left = Math.max(VIEW_PAD, Math.min(left, maxLeft));

    let top = wordRect.top - popupRect.height - GAP;
    if (top < VIEW_PAD) {
      const below = wordRect.bottom + GAP;
      top = below + popupRect.height < window.innerHeight - CONTROL_GUTTER
        ? below
        : Math.max(VIEW_PAD, maxTop);
    }
    top = Math.min(top, Math.max(VIEW_PAD, maxTop));

    el.style.left = left + "px";
    el.style.top = top + "px";
  }

  globalThis.NetflixLanguage.createTranslationPopup = function () {
    ensureStyle();

    const root = document.createElement("div");
    root.className = "nflx-lang-popup";
    root.hidden = true;
    root.tabIndex = -1;
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-modal", "true");
    root.setAttribute("aria-label", "Word translation");

    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.className = "nflx-lang-popup-close";
    closeBtn.setAttribute("aria-label", "Close");
    closeBtn.textContent = "×";

    const wordEl = document.createElement("p");
    wordEl.className = "nflx-lang-popup-word";

    const lemmaEl = document.createElement("p");
    lemmaEl.className = "nflx-lang-popup-lemma";
    lemmaEl.hidden = true;

    const statusEl = document.createElement("div");
    statusEl.className = "nflx-lang-popup-status";

    const spinnerEl = document.createElement("span");
    spinnerEl.className = "nflx-lang-popup-spinner";
    spinnerEl.hidden = true;

    const messageEl = document.createElement("p");
    messageEl.className = "nflx-lang-popup-meaning";
    messageEl.style.margin = "0";
    messageEl.setAttribute("aria-live", "polite");

    statusEl.append(spinnerEl, messageEl);

    const contextEl = document.createElement("p");
    contextEl.className = "nflx-lang-popup-context";
    contextEl.hidden = true;

    const actions = document.createElement("div");
    actions.className = "nflx-lang-popup-actions";

    const retryBtn = document.createElement("button");
    retryBtn.type = "button";
    retryBtn.className = "nflx-lang-popup-retry";
    retryBtn.textContent = "Retry";
    retryBtn.hidden = true;

    const saveBtn = document.createElement("button");
    saveBtn.type = "button";
    saveBtn.className = "nflx-lang-popup-save";
    saveBtn.textContent = "Save word";
    saveBtn.disabled = true;

    actions.append(retryBtn, saveBtn);
    root.append(closeBtn, wordEl, lemmaEl, statusEl, contextEl, actions);
    document.documentElement.appendChild(root);

    let anchorEl = null;
    let onRetry = null;
    let onSave = null;
    let onHide = null;
    let currentWord = "";
    let currentLemma = "";
    let currentTranslation = "";
    let currentPos = "";
    let saving = false;
    let hideTimer = 0;

    const AUTO_HIDE_MS = 4500;
    const SAVED_HIDE_MS = 900;
    let hideAfter = 0;
    let hidePaused = false;

    function clearHideTimer() {
      if (hideTimer) {
        window.clearTimeout(hideTimer);
        hideTimer = 0;
      }
    }

    function scheduleHide(ms) {
      hideAfter = Date.now() + ms;
      clearHideTimer();
      if (hidePaused) {
        return;
      }
      hideTimer = window.setTimeout(function () {
        hideTimer = 0;
        hide();
      }, ms);
    }

    function pauseHide() {
      hidePaused = true;
      clearHideTimer();
    }

    function resumeHide() {
      hidePaused = false;
      if (!root.hidden && hideAfter > Date.now()) {
        scheduleHide(hideAfter - Date.now());
      }
    }

    function resetSaveButton() {
      saveBtn.textContent = "Save word";
      saveBtn.classList.remove("is-saved");
    }

    function markSaved(label) {
      saveBtn.textContent = label || "Saved";
      saveBtn.classList.add("is-saved");
      saveBtn.disabled = true;
      saveBtn.setAttribute("aria-disabled", "true");
    }

    function render(kind, text) {
      const loading = kind === "loading";
      const error = kind === "error";
      const ready = kind === "ready" && Boolean(text);

      if (loading || error) {
        currentTranslation = "";
        currentLemma = "";
        currentPos = "";
        lemmaEl.hidden = true;
        lemmaEl.textContent = "";
        contextEl.hidden = true;
        contextEl.textContent = "";
        resetSaveButton();
      }

      spinnerEl.hidden = !loading;
      statusEl.classList.toggle("is-loading", loading);
      statusEl.classList.toggle("is-error", error);
      messageEl.textContent = text;
      retryBtn.hidden = !error;
      if (!saveBtn.classList.contains("is-saved")) {
        saveBtn.disabled = !ready || saving;
        saveBtn.setAttribute("aria-disabled", saveBtn.disabled ? "true" : "false");
      }
      window.requestAnimationFrame(function () {
        placePopup(root, anchorEl);
      });
    }

    function hide() {
      const hideCb = onHide;
      clearHideTimer();
      root.hidden = true;
      onRetry = null;
      onHide = null;
      currentWord = "";
      currentLemma = "";
      currentPos = "";
      currentTranslation = "";
      lemmaEl.hidden = true;
      lemmaEl.textContent = "";
      contextEl.hidden = true;
      contextEl.textContent = "";
      saving = false;
      resetSaveButton();
      if (hideCb) {
        hideCb();
      }
    }

    function show(details) {
      const word = details && details.word;
      const nextAnchor = details && details.anchor;
      if (!word || !nextAnchor) {
        return;
      }

      wordEl.textContent = word;
      currentWord = word;
      currentLemma = "";
      currentPos = "";
      currentTranslation = "";
      lemmaEl.hidden = true;
      lemmaEl.textContent = "";
      contextEl.hidden = true;
      contextEl.textContent = "";
      currentSource = (details && details.source) || "netflix";
      anchorEl = nextAnchor;
      onRetry = details.onRetry || null;
      onSave = details.onSave || null;
      onHide = details.onHide || null;
      saving = false;
      resetSaveButton();
      clearHideTimer();
      root.hidden = false;
      render("loading", "Translating…");
      root.focus({ preventScroll: true });
    }

    function glossKey(value) {
      return String(value || "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .trim();
    }

    function setTranslation(details) {
      const data =
        details && typeof details === "object" ? details : { translation: details };
      const canonical = String(
        data.canonical_translation || data.translation || ""
      ).trim();
      const contextual = String(
        data.contextual_meaning || data.contextual_translation || ""
      ).trim();
      const lemma = String(data.lemma || currentWord || "").trim();
      const clicked = String(data.clicked_form || currentWord || "").trim();
      const display = String(data.display_word || lemma || clicked).trim();
      const idiomatic = Boolean(data.is_idiomatic);
      const idiom = String(data.idiom_or_expression || "").trim();
      if (!canonical || !lemma) {
        render("error", "No translation returned");
        return;
      }
      currentWord = clicked || currentWord;
      currentLemma = lemma;
      currentTranslation = canonical;
      currentPos = String(data.part_of_speech || "").trim().toLowerCase();
      wordEl.textContent = display || lemma;
      if (lemma && clicked && lemma.toLowerCase() !== clicked.toLowerCase()) {
        lemmaEl.hidden = false;
        lemmaEl.textContent = "Clicked “" + clicked + "” · save as " + lemma;
      } else {
        lemmaEl.hidden = true;
        lemmaEl.textContent = "";
      }

      const contextDiffers =
        Boolean(contextual) && glossKey(contextual) !== glossKey(canonical);
      if (idiomatic) {
        render("ready", contextual || canonical);
        const extra = [];
        if (idiom) {
          extra.push("Idiom: " + idiom);
        }
        extra.push("Saved as " + lemma + " · " + canonical);
        contextEl.hidden = false;
        contextEl.textContent = extra.join(" · ");
      } else if (contextDiffers) {
        render("ready", canonical);
        contextEl.hidden = false;
        contextEl.textContent = "In this line: " + contextual;
      } else {
        render("ready", canonical);
        contextEl.hidden = true;
        contextEl.textContent = "";
      }
      window.requestAnimationFrame(function () {
        placePopup(root, anchorEl);
      });
      scheduleHide(idiomatic || contextDiffers ? 7000 : AUTO_HIDE_MS);
    }

    function setError(text) {
      render("error", text || "Translation failed");
      scheduleHide(AUTO_HIDE_MS);
    }

    function stopPlayerClick(event) {
      event.stopPropagation();
    }

    function onOutsidePointer(event) {
      if (root.hidden) {
        return;
      }
      if (root.contains(event.target)) {
        return;
      }
      if (event.target.closest && event.target.closest(".nflx-lang-word")) {
        return;
      }
      hide();
    }

    closeBtn.addEventListener("click", function (event) {
      event.preventDefault();
      stopPlayerClick(event);
      hide();
    });

    retryBtn.addEventListener("click", function (event) {
      event.preventDefault();
      stopPlayerClick(event);
      clearHideTimer();
      if (onRetry) {
        onRetry();
      }
    });

    saveBtn.addEventListener("click", function (event) {
      event.preventDefault();
      stopPlayerClick(event);
      if (saveBtn.disabled || saving || !currentLemma || !currentTranslation) {
        return;
      }
      if (!onSave) {
        return;
      }

      saving = true;
      saveBtn.disabled = true;
      saveBtn.textContent = "Saving…";
      Promise.resolve(
        onSave({
          word: currentLemma,
          lemma: currentLemma,
          translation: currentTranslation,
          part_of_speech: currentPos,
          source: currentSource,
        })
      )
        .then(function (result) {
          saving = false;
          const reopened = result && result.reopened;
          markSaved(
            reopened ? "Already saved · moved back to learning" : "Saved"
          );
          scheduleHide(reopened ? 2200 : SAVED_HIDE_MS);
        })
        .catch(function (err) {
          saving = false;
          resetSaveButton();
          saveBtn.disabled = false;
          statusEl.classList.add("is-error");
          messageEl.textContent = (err && err.message) || "Could not save word";
        });
    });

    root.addEventListener("mousedown", stopPlayerClick);
    root.addEventListener("click", stopPlayerClick);
    root.addEventListener("mouseenter", pauseHide);
    root.addEventListener("mouseleave", resumeHide);
    root.addEventListener("focusin", pauseHide);
    root.addEventListener("focusout", function (event) {
      if (!root.contains(event.relatedTarget)) {
        resumeHide();
      }
    });
    document.addEventListener("pointerdown", onOutsidePointer, true);
    document.addEventListener("keydown", function (event) {
      if (root.hidden) {
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        hide();
        return;
      }
      if ((event.key === "s" || event.key === "S") && !event.metaKey && !event.ctrlKey) {
        if (!saveBtn.disabled) {
          event.preventDefault();
          saveBtn.click();
        }
      }
    });

    return {
      show: show,
      hide: hide,
      setTranslation: setTranslation,
      setError: setError,
    };
  };
})();
