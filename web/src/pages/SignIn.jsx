import { useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

export function SignIn() {
  const { user, configured, signIn, signUp, signInWithGoogle } = useAuth();
  const location = useLocation();
  const from = location.state?.from || "/";
  const [mode, setMode] = useState("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);

  if (user) {
    return <Navigate to={from} replace />;
  }

  async function onSubmit(event) {
    event.preventDefault();
    setError("");
    setInfo("");
    setBusy(true);

    const action = mode === "signup" ? signUp : signIn;
    const { data, error: nextError } = await action(email, password).catch(
      (err) => ({ data: null, error: err })
    );

    setBusy(false);

    if (nextError) {
      setError(nextError.message || "Could not sign in");
      return;
    }

    if (mode === "signup" && !data?.session) {
      setInfo("Check your email to confirm the account, then sign in.");
    }
  }

  return (
    <section className="auth">
      <h1>{mode === "signup" ? "Create account" : "Sign in"}</h1>
      <p className="lede">Use email or Google. This is the same account as the extension.</p>
      {!configured && (
        <p className="auth-error">
          Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to web/.env.local.
        </p>
      )}
      <form className="auth-form" onSubmit={onSubmit}>
        <label>
          Email
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </label>
        <label>
          Password
          <input
            type="password"
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            minLength={6}
          />
        </label>
        {error && <p className="auth-error">{error}</p>}
        {info && <p className="auth-info">{info}</p>}
        <button type="submit" disabled={busy || !configured}>
          {busy ? "Please wait…" : mode === "signup" ? "Create account" : "Sign in"}
        </button>
      </form>
      <button
        type="button"
        className="google-btn"
        disabled={busy || !configured}
        onClick={async () => {
          setError("");
          setBusy(true);
          const { error: nextError } = await signInWithGoogle().catch((err) => ({
            error: err,
          }));
          setBusy(false);
          if (nextError) {
            setError(nextError.message || "Google sign-in failed");
          }
        }}
      >
        Sign in with Google
      </button>
      <button
        type="button"
        className="linkish"
        onClick={() => {
          setMode(mode === "signup" ? "signin" : "signup");
          setError("");
          setInfo("");
        }}
      >
        {mode === "signup" ? "Have an account? Sign in" : "Need an account? Create one"}
      </button>
    </section>
  );
}
