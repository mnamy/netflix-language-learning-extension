// Clickable subtitle overlay. Site-agnostic: it only needs a text string
// and a layout box from the active adapter.
//
// Words are buttons. Punctuation stays visible as plain text.
// The overlay root ignores pointer events so player controls still work.

globalThis.NetflixLanguage = globalThis.NetflixLanguage || {};

(function () {
  const STYLE_ID = "nflx-lang-overlay-style";

  const css = `
    .nflx-lang-overlay {
      position: fixed;
      z-index: 2147483646;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      pointer-events: none;
      text-align: center;
      color: #fff;
      font-weight: 600;
      letter-spacing: 0.01em;
      text-shadow:
        0 1px 1px rgba(0, 0, 0, 0.9),
        0 0 0.35em rgba(0, 0, 0, 0.85),
        0 0 0.7em rgba(0, 0, 0, 0.55);
      line-height: 1.35;
      user-select: none;
    }
    .nflx-lang-overlay[hidden] {
      display: none !important;
    }
    .nflx-lang-line {
      white-space: nowrap;
      font-size: inherit;
    }
    .nflx-lang-word {
      pointer-events: auto;
      margin: 0 0.02em;
      padding: 0.12em 0.16em;
      min-height: 1.5em;
      border: none;
      background: transparent;
      color: inherit;
      font: inherit;
      font-weight: inherit;
      line-height: inherit;
      text-shadow: inherit;
      cursor: pointer;
      border-radius: 0.22em;
    }
    .nflx-lang-word:hover {
      background: rgba(229, 9, 20, 0.38);
      box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.18);
    }
    .nflx-lang-word:focus-visible {
      background: rgba(229, 9, 20, 0.45);
      outline: 2px solid #fff;
      outline-offset: 2px;
    }
    .nflx-lang-word.is-open {
      background: rgba(229, 9, 20, 0.55);
    }
  `;

  function tokenizeLine(line) {
    return globalThis.NetflixLanguage.tokenizeSubtitleLine(line);
  }

  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) {
      return;
    }
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = css;
    document.documentElement.appendChild(style);
  }

  globalThis.NetflixLanguage.createSubtitleOverlay = function (options) {
    const onWordClick = options && options.onWordClick;
    let renderedText = null;

    ensureStyle();

    const root = document.createElement("div");
    root.className = "nflx-lang-overlay";
    root.hidden = true;
    document.documentElement.appendChild(root);

    function stopPlayerClick(event) {
      event.preventDefault();
      event.stopPropagation();
    }

    function clearOpenWord() {
      const open = root.querySelectorAll(".nflx-lang-word.is-open");
      for (let i = 0; i < open.length; i++) {
        open[i].classList.remove("is-open");
      }
    }

    function onWordClickEvent(event) {
      stopPlayerClick(event);
      const raw = event.currentTarget.getAttribute("data-word") || "";
      const word = globalThis.NetflixLanguage.normalizeClickedWord(raw);
      if (word && onWordClick) {
        clearOpenWord();
        event.currentTarget.classList.add("is-open");
        onWordClick(word, event.currentTarget);
      }
    }

    function rebuild(text) {
      root.replaceChildren();
      const lines = text.split("\n").filter(function (line) {
        return line.length > 0;
      });

      for (let i = 0; i < lines.length; i++) {
        const lineEl = document.createElement("div");
        lineEl.className = "nflx-lang-line";
        const parts = tokenizeLine(lines[i]);

        for (let j = 0; j < parts.length; j++) {
          const part = parts[j];
          if (part.type !== "word") {
            lineEl.appendChild(document.createTextNode(part.value));
            continue;
          }

          const button = document.createElement("button");
          button.type = "button";
          button.className = "nflx-lang-word";
          button.setAttribute("data-word", part.word || part.value);
          button.setAttribute("aria-label", "Look up " + (part.word || part.value));
          button.textContent = part.value;
          button.addEventListener("click", onWordClickEvent);
          button.addEventListener("mousedown", stopPlayerClick);
          lineEl.appendChild(button);
        }

        root.appendChild(lineEl);
      }
    }

    // Native Netflix captions are often small. Scale up so words are
    // readable and still sit on the caption baseline.
    const FONT_SCALE = 1.55;
    const CONTROL_GUTTER = 104;

    function applyLayout(layout) {
      if (!layout) {
        root.style.top = "auto";
        root.style.bottom = CONTROL_GUTTER + "px";
        root.style.left = "8%";
        root.style.width = "84%";
        root.style.height = "auto";
        root.style.fontSize = "2.5rem";
        root.style.fontFamily = "sans-serif";
        return;
      }

      const nativeFont = parseFloat(layout.fontSize) || 24;
      const fontSize = nativeFont * FONT_SCALE;
      const width = Math.min(
        window.innerWidth * 0.9,
        Math.max(layout.width * 1.2, layout.width)
      );
      const height = Math.max(layout.height * FONT_SCALE, fontSize * 1.55);
      const left = layout.left + layout.width / 2 - width / 2;
      let top = layout.top + layout.height - height;
      const maxTop = window.innerHeight - height - CONTROL_GUTTER;
      top = Math.min(Math.max(12, top), Math.max(12, maxTop));

      root.style.bottom = "auto";
      root.style.top = top + "px";
      root.style.left = Math.max(12, left) + "px";
      root.style.width = width + "px";
      root.style.height = height + "px";
      root.style.fontSize = fontSize + "px";
      root.style.fontFamily = layout.fontFamily || "sans-serif";
      if (layout.fontWeight) {
        root.style.fontWeight = layout.fontWeight;
      }
      if (layout.color) {
        root.style.color = layout.color;
      }
    }

    return {
      clearOpenWord: clearOpenWord,
      sync: function (text, layout) {
        if (!text) {
          renderedText = "";
          root.hidden = true;
          root.replaceChildren();
          return;
        }

        if (text !== renderedText) {
          rebuild(text);
          renderedText = text;
        }

        applyLayout(layout);
        root.hidden = false;
      },
    };
  };
})();
