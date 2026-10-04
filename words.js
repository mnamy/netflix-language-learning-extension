(function () {
  const searchEl = document.getElementById("search");
  const sortEl = document.getElementById("sort");
  const listEl = document.getElementById("list");
  const emptyEl = document.getElementById("empty");
  const statusEl = document.getElementById("account-status");
  const formEl = document.getElementById("sign-in-form");
  const errorEl = document.getElementById("account-error");
  const signOutEl = document.getElementById("sign-out");
  const googleEl = document.getElementById("google-sign-in");
  const bankEl = document.getElementById("bank");

  let words = [];
  let signedIn = false;

  function formatDate(savedAt) {
    if (!savedAt) {
      return "";
    }
    return new Date(savedAt).toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  function filtered() {
    const query = searchEl.value.trim().toLowerCase();
    const newestFirst = sortEl.value !== "oldest";
    return words
      .filter(function (item) {
        if (!query) {
          return true;
        }
        const hay = [item.word, item.translation, item.sourceLanguage]
          .join(" ")
          .toLowerCase();
        return hay.indexOf(query) !== -1;
      })
      .sort(function (a, b) {
        const left = Number(a.savedAt) || 0;
        const right = Number(b.savedAt) || 0;
        return newestFirst ? right - left : left - right;
      });
  }

  function render() {
    if (!signedIn) {
      listEl.replaceChildren();
      emptyEl.hidden = true;
      return;
    }
    const items = filtered();
    listEl.replaceChildren();
    emptyEl.hidden = items.length > 0;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const id = NetflixLanguage.savedWordId(item);
      const row = document.createElement("li");
      row.className = "row";

      const info = document.createElement("div");
      const word = document.createElement("p");
      word.className = "word";
      word.textContent = item.word || "";

      const meaning = document.createElement("p");
      meaning.className = "meaning";
      meaning.textContent = item.translation || "";

      const meta = document.createElement("p");
      meta.className = "meta";
      const parts = [];
      if (item.sourceLanguage) {
        parts.push(item.sourceLanguage);
      }
      const date = formatDate(item.savedAt);
      if (date) {
        parts.push(date);
      }
      meta.textContent = parts.join(" · ");

      info.append(word, meaning, meta);

      const del = document.createElement("button");
      del.type = "button";
      del.className = "delete";
      del.textContent = "Delete";
      del.addEventListener("click", function () {
        if (!window.confirm("Delete “" + (item.word || "this word") + "”?")) {
          return;
        }
        NetflixLanguage.deleteSavedWord(id).then(load);
      });

      row.append(info, del);
      listEl.appendChild(row);
    }
  }

  function load() {
    NetflixLanguage.listSavedWords().then(function (list) {
      words = list;
      render();
    });
  }

  searchEl.addEventListener("input", render);
  sortEl.addEventListener("change", render);
  chrome.storage.onChanged.addListener(function (changes, area) {
    if (area === "local" && changes.savedWords && signedIn) {
      load();
    }
  });

  function showAccountError(message) {
    errorEl.hidden = !message;
    errorEl.textContent = message || "";
  }

  function renderAccount(user) {
    showAccountError("");
    signedIn = Boolean(user);
    bankEl.hidden = !signedIn;
    googleEl.hidden = Boolean(user) || !NetflixLanguage.supabaseConfigured();
    if (user) {
      statusEl.textContent = "Signed in as " + (user.email || "your account");
      formEl.hidden = true;
      signOutEl.hidden = false;
      load();
      return;
    }
    words = [];
    render();
    statusEl.textContent = NetflixLanguage.supabaseConfigured()
      ? "Sign in to see your word bank. Words saved on Netflix stay on this device until you sign in."
      : "Add your Supabase URL and anon key in src/supabase/public-config.js";
    formEl.hidden = !NetflixLanguage.supabaseConfigured();
    signOutEl.hidden = true;
  }

  formEl.addEventListener("submit", function (event) {
    event.preventDefault();
    NetflixLanguage.signInToAccount(
      document.getElementById("email").value,
      document.getElementById("password").value
    )
      .then(function (session) {
        renderAccount(session.user);
      })
      .catch(function (err) {
        showAccountError(err.message || "Sign in failed");
      });
  });

  signOutEl.addEventListener("click", function () {
    NetflixLanguage.signOutOfAccount().then(function () {
      renderAccount(null);
    });
  });

  googleEl.addEventListener("click", function () {
    showAccountError("");
    NetflixLanguage.signInWithGoogle()
      .then(function (session) {
        renderAccount(session.user);
      })
      .catch(function (err) {
        showAccountError(err.message || "Google sign-in failed");
      });
  });

  NetflixLanguage.getAccount().then(renderAccount).catch(function () {
    renderAccount(null);
  });
})();
