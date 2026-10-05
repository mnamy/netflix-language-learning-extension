(function () {
  const statusEl = document.getElementById("account-status");
  const formEl = document.getElementById("sign-in-form");
  const errorEl = document.getElementById("account-error");
  const signOutEl = document.getElementById("sign-out");
  const googleEl = document.getElementById("google-sign-in");
  const actionsEl = document.getElementById("signed-in-actions");
  const openBankEl = document.getElementById("open-bank");

  function webAppUrl() {
    const pub = NetflixLanguage.supabasePublic || {};
    return String(pub.webAppUrl || "http://localhost:5173").trim().replace(/\/$/, "");
  }

  function showAccountError(message) {
    errorEl.hidden = !message;
    errorEl.textContent = message || "";
  }

  function renderAccount(user) {
    showAccountError("");
    googleEl.hidden = Boolean(user) || !NetflixLanguage.supabaseConfigured();
    if (user) {
      statusEl.textContent = "Signed in as " + (user.email || "your account");
      formEl.hidden = true;
      actionsEl.hidden = false;
      return;
    }
    statusEl.textContent = NetflixLanguage.supabaseConfigured()
      ? "Sign in to save words from Netflix."
      : "Add your Supabase URL and anon key in src/supabase/public-config.js";
    formEl.hidden = !NetflixLanguage.supabaseConfigured();
    actionsEl.hidden = true;
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

  openBankEl.addEventListener("click", function () {
    chrome.tabs.create({ url: webAppUrl() });
  });

  NetflixLanguage.getAccount().then(renderAccount).catch(function () {
    renderAccount(null);
  });
})();
