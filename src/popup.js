// Translation popup UI. Site-agnostic: no Netflix DOM selectors.
// One popup at a time. Shows word + meaning only — never the sentence.

globalThis.NetflixLanguage = globalThis.NetflixLanguage || {};

(function () {
  const STYLE_ID = "nflx-lang-popup-style";
  const GAP = 10;
  const VIEW_PAD = 12;
  const CONTROL_GUTTER = 88;

  const css = `
    .nflx-lang-popup {
      position: fixed;
      z-index: 2147483647;
      box-sizing: border-box;
      min-width: 196px;
      max-width: 280px;
      padding: 14px 16px 12px;
      border-radius: 12px;
      background: rgba(18, 18, 18, 0.96);
      color: #fff;
      font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
      box-shadow: 0 10px 28px rgba(0, 0, 0, 0.45);
      border: 1px solid rgba(255, 255, 255, 0.08);
      pointer-events: auto;
    }
    .nflx-lang-popup[hidden] {
      display: none !important;
    }
    .nflx-lang-popup-close {
      position: absolute;
      top: 6px;
      right: 6px;
      width: 28px;
      height: 28px;
      border: none;
      border-radius: 8px;
      background: transparent;
      color: rgba(255, 255, 255, 0.72);
      font-size: 18px;
      line-height: 1;
      cursor: pointer;
    }
    .nflx-lang-popup-close:hover,
    .nflx-lang-popup-close:focus-visible {
      background: rgba(255, 255, 255, 0.1);
      color: #fff;
      outline: none;
    }
    .nflx-lang-popup-word {
      margin: 0 28px 6px 0;
      font-size: 18px;
      font-weight: 650;
      line-height: 1.25;
      word-break: break-word;
    }
    .nflx-lang-popup-status {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      margin: 0 0 10px;
      font-size: 13px;
      line-height: 1.35;
      color: rgba(255, 255, 255, 0.72);
      min-height: 1.35em;
    }
    .nflx-lang-popup-status.is-loading {
      color: rgba(255, 255, 255, 0.5);
    }
    .nflx-lang-popup-status.is-error {
      color: #ff8a80;
    }
    .nflx-lang-popup-spinner {
      flex: 0 0 auto;
      width: 12px;
      height: 12px;
      margin-top: 3px;
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
      height: 32px;
      padding: 0 12px;
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
      outline: none;
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
      outline: none;
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
      top = Math.min(wordRect.bottom + GAP, Math.max(VIEW_PAD, maxTop));
    } else {
      top = Math.min(top, Math.max(VIEW_PAD, maxTop));
    }

    el.style.left = left + "px";
    el.style.top = top + "px";
  }

  globalThis.NetflixLanguage.createTranslationPopup = function () {
    ensureStyle();

    const root = document.createElement("div");
    root.className = "nflx-lang-popup";
    root.hidden = true;
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-label", "Word translation");

    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.className = "nflx-lang-popup-close";
    closeBtn.setAttribute("aria-label", "Close");
    closeBtn.textContent = "×";

    const wordEl = document.createElement("p");
    wordEl.className = "nflx-lang-popup-word";

    const statusEl = document.createElement("div");
    statusEl.className = "nflx-lang-popup-status";

    const spinnerEl = document.createElement("span");
    spinnerEl.className = "nflx-lang-popup-spinner";
    spinnerEl.hidden = true;

    const messageEl = document.createElement("p");
    messageEl.className = "nflx-lang-popup-meaning";
    messageEl.style.margin = "0";

    statusEl.append(spinnerEl, messageEl);

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
    root.append(closeBtn, wordEl, statusEl, actions);
    document.documentElement.appendChild(root);

    let anchorEl = null;
    let onRetry = null;
    let onSave = null;
    let currentWord = "";
    let currentTranslation = "";
    let currentSource = "netflix";
    let saving = false;
    let hideTimer = 0;

    const AUTO_HIDE_MS = 4000;
    const SAVED_HIDE_MS = 700;

    function clearHideTimer() {
      if (hideTimer) {
        window.clearTimeout(hideTimer);
        hideTimer = 0;
      }
    }

    function scheduleHide(ms) {
      clearHideTimer();
      hideTimer = window.setTimeout(function () {
        hideTimer = 0;
        hide();
      }, ms);
    }

    function resetSaveButton() {
      saveBtn.textContent = "Save word";
      saveBtn.classList.remove("is-saved");
    }

    function markSaved() {
      saveBtn.textContent = "Saved";
      saveBtn.classList.add("is-saved");
      saveBtn.disabled = true;
    }

    function render(kind, text) {
      const loading = kind === "loading";
      const error = kind === "error";
      const ready = kind === "ready" && Boolean(text);

      if (ready) {
        currentTranslation = text;
      } else if (loading || error) {
        currentTranslation = "";
        resetSaveButton();
      }

      spinnerEl.hidden = !loading;
      statusEl.classList.toggle("is-loading", loading);
      statusEl.classList.toggle("is-error", error);
      messageEl.textContent = text;
      retryBtn.hidden = !error;
      if (!saveBtn.classList.contains("is-saved")) {
        saveBtn.disabled = !ready || saving;
      }
      placePopup(root, anchorEl);
    }

    function hide() {
      clearHideTimer();
      root.hidden = true;
      onRetry = null;
      currentWord = "";
      currentTranslation = "";
      saving = false;
      resetSaveButton();
    }

    function show(details) {
      const word = details && details.word;
      const nextAnchor = details && details.anchor;
      if (!word || !nextAnchor) {
        return;
      }

      wordEl.textContent = word;
      currentWord = word;
      currentTranslation = "";
      currentSource = (details && details.source) || "netflix";
      anchorEl = nextAnchor;
      onRetry = details.onRetry || null;
      onSave = details.onSave || null;
      saving = false;
      resetSaveButton();
      clearHideTimer();
      root.hidden = false;
      render("loading", "Translating…");
    }

    function setLoading() {
      render("loading", "Translating…");
    }

    function setTranslation(text) {
      const translation = String(text || "").trim();
      if (!translation) {
        render("error", "No translation returned");
        return;
      }
      render("ready", translation);
      scheduleHide(AUTO_HIDE_MS);
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
      if (saveBtn.disabled || saving || !currentWord || !currentTranslation) {
        return;
      }
      if (!onSave) {
        return;
      }

      saving = true;
      saveBtn.disabled = true;
      Promise.resolve(
        onSave({
          word: currentWord,
          translation: currentTranslation,
          source: currentSource,
        })
      )
        .then(function () {
          saving = false;
          markSaved();
          scheduleHide(SAVED_HIDE_MS);
        })
        .catch(function () {
          saving = false;
          saveBtn.disabled = false;
          resetSaveButton();
        });
    });

    root.addEventListener("mousedown", stopPlayerClick);
    root.addEventListener("click", stopPlayerClick);
    document.addEventListener("pointerdown", onOutsidePointer, true);
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") {
        hide();
      }
    });

    return {
      show: show,
      hide: hide,
      setLoading: setLoading,
      setTranslation: setTranslation,
      setError: setError,
    };
  };
})();
