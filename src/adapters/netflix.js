// Netflix subtitle adapter.
// All Netflix DOM details stay in this file.
//
// Content scripts share one scope. Assign to globalThis.NetflixLanguage
// instead of declaring const NetflixLanguage here.

globalThis.NetflixLanguage = globalThis.NetflixLanguage || {};

(function () {
  const OVERLAY_SELECTOR = ".player-timedtext";
  const TEXT_SELECTOR = ".player-timedtext-text-container";
  const HIDE_STYLE_ID = "nflx-lang-hide-native";

  function normalize(text) {
    return (text || "").replace(/\s+/g, " ").trim();
  }

  function readOverlayText(overlay) {
    if (!overlay) {
      return "";
    }

    const containers = overlay.querySelectorAll(TEXT_SELECTOR);
    if (containers.length === 0) {
      return overlay.innerText || "";
    }

    return Array.from(containers)
      .map((el) => el.innerText || "")
      .join("\n");
  }

  // Latest non-empty cue only. Used while Netflix hides the native
  // line between subtitles. Never a history list.
  let latestCue = "";

  function getCurrentSubtitle() {
    const overlay = document.querySelector(OVERLAY_SELECTOR);
    return normalize(readOverlayText(overlay));
  }

  function getLatestSubtitle() {
    return getCurrentSubtitle() || latestCue;
  }

  function isPlaybackActive() {
    const video = document.querySelector("video");
    return Boolean(video && !video.paused && !video.ended);
  }

  // Position and font of the native cue, so our overlay can sit on top
  // without reading Netflix selectors elsewhere.
  function getSubtitleLayout() {
    const overlay = document.querySelector(OVERLAY_SELECTOR);
    if (!overlay) {
      return null;
    }

    const container = overlay.querySelector(TEXT_SELECTOR) || overlay;
    const rect = container.getBoundingClientRect();
    if (rect.width < 2 && rect.height < 2) {
      return null;
    }

    const styleSource = container.querySelector("span") || container;
    const style = window.getComputedStyle(styleSource);

    return {
      top: rect.top,
      left: rect.left,
      width: rect.width,
      height: rect.height,
      fontSize: style.fontSize,
      fontFamily: style.fontFamily,
      fontWeight: style.fontWeight,
      color: "#ffffff",
    };
  }

  // Hide native captions visually. We still read them; we do not edit
  // Netflix's subtitle nodes.
  function hideNativeSubtitles() {
    if (document.getElementById(HIDE_STYLE_ID)) {
      return;
    }

    const style = document.createElement("style");
    style.id = HIDE_STYLE_ID;
    style.textContent =
      OVERLAY_SELECTOR + "{opacity:0 !important;pointer-events:none !important;}";
    document.documentElement.appendChild(style);
  }

  // callback(text) on cue or layout changes. Empty string means the
  // player is gone or idle — not a normal gap between lines.
  function onSubtitleChange(callback) {
    let overlayEl = null;
    let overlayObserver = null;

    function emit() {
      const text = getCurrentSubtitle();
      if (text) {
        latestCue = text;
        callback(text);
        return;
      }

      // Netflix often blanks the cue between lines. Keep the last one.
      if (isPlaybackActive()) {
        return;
      }

      latestCue = "";
      callback("");
    }

    function detachOverlay(notify) {
      if (overlayObserver) {
        overlayObserver.disconnect();
        overlayObserver = null;
      }
      overlayEl = null;
      if (notify && !isPlaybackActive()) {
        latestCue = "";
        callback("");
      }
    }

    function attachOverlay(el) {
      if (el === overlayEl) {
        return;
      }

      detachOverlay(false);
      overlayEl = el;

      overlayObserver = new MutationObserver(emit);
      overlayObserver.observe(el, {
        childList: true,
        subtree: true,
        characterData: true,
        attributes: true,
      });

      emit();
    }

    function syncOverlay() {
      const el = document.querySelector(OVERLAY_SELECTOR);
      if (el) {
        attachOverlay(el);
      } else if (overlayEl) {
        detachOverlay(true);
      }
    }

    const documentObserver = new MutationObserver(syncOverlay);
    documentObserver.observe(document.documentElement, {
      childList: true,
      subtree: true,
    });

    syncOverlay();
  }

  globalThis.NetflixLanguage.netflixAdapter = {
    id: "netflix",
    isMatch() {
      return location.hostname.endsWith("netflix.com");
    },
    getCurrentSubtitle,
    getLatestSubtitle,
    getSubtitleLayout,
    hideNativeSubtitles,
    onSubtitleChange,
  };
})();
