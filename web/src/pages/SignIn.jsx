import { useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

export function SignIn() {
  const { user, configured, signIn, signInWithGoogle, accessDenied, clearAccessDenied } =
    useAuth();
  const location = useLocation();
  const from = location.state?.from || "/";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (user) {
    return <Navigate to={from} replace />;
  }

  if (accessDenied) {
    return (
      <section className="auth">
        <h1>Oops, looks like you don’t have access right now!</h1>
        <p className="lede">This version is currently private.</p>
        <div className="auth-form">
          <button type="button" onClick={() => clearAccessDenied()}>
            Try another account
          </button>
        </div>
      </section>
    );
  }

  async function onSubmit(event) {
    event.preventDefault();
    setError("");
    setBusy(true);

    const { error: nextError } = await signIn(email, password).catch((err) => ({
      error: err,
    }));

    setBusy(false);

    if (nextError) {
      setError(nextError.message || "Could not sign in");
    }
  }

  return (
    <section className="auth">
      <h1>Sign in</h1>
      <p className="lede">Use the same Google or email account as the extension.</p>
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
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            minLength={6}
          />
        </label>
        {error && <p className="auth-error">{error}</p>}
        <button type="submit" disabled={busy || !configured}>
          {busy ? "Please wait…" : "Sign in"}
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
    </section>
  );
}
