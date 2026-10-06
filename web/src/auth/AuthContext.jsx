import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

const AuthContext = createContext(null);

const ACCESS_DENIED_KEY = "nflxAccessDenied";

function webOAuthRedirectTo() {
  return window.location.origin + "/sign-in";
}

function allowedUserId() {
  return String(import.meta.env.VITE_ALLOWED_USER_ID || "").trim();
}

function sessionIsAllowed(session) {
  const allowed = allowedUserId();
  if (!allowed || !session?.user?.id) {
    return true;
  }
  return session.user.id === allowed;
}

function storageGet(key) {
  try {
    if (sessionStorage.getItem(key) === "1") {
      return true;
    }
  } catch (err) {
    // sessionStorage can be unavailable in some browser modes.
  }
  try {
    return localStorage.getItem(key) === "1";
  } catch (err) {
    return false;
  }
}

function storageSet(key, denied) {
  const value = denied ? "1" : null;
  for (const store of [sessionStorage, localStorage]) {
    try {
      if (value) {
        store.setItem(key, value);
      } else {
        store.removeItem(key);
      }
    } catch (err) {
      // Ignore storage write failures.
    }
  }
}

function readAccessDenied() {
  return storageGet(ACCESS_DENIED_KEY);
}

function persistAccessDenied(denied) {
  storageSet(ACCESS_DENIED_KEY, denied);
}

function oauthCallbackError() {
  const query = new URLSearchParams(window.location.search);
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  return (
    hash.get("error_description") ||
    query.get("error_description") ||
    hash.get("error") ||
    query.get("error") ||
    ""
  );
}

function hasOAuthCallbackParams() {
  const query = new URLSearchParams(window.location.search);
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  return Boolean(
    query.get("code") ||
      query.get("access_token") ||
      hash.get("access_token") ||
      query.get("error") ||
      hash.get("error")
  );
}

function clearOAuthCallbackParams() {
  if (!hasOAuthCallbackParams()) {
    return;
  }
  window.history.replaceState({}, "", window.location.pathname);
}

function rejectDisallowedSession() {
  persistAccessDenied(true);
  clearOAuthCallbackParams();
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [ready, setReady] = useState(!supabase);
  const [accessDenied, setAccessDenied] = useState(readAccessDenied);

  useEffect(() => {
    if (!supabase) {
      return;
    }

    let ignore = false;
    let pendingSignOut = false;

    const readyTimeout = window.setTimeout(() => {
      if (!ignore) {
        setReady(true);
      }
    }, 8000);

    function markAccessDenied() {
      rejectDisallowedSession();
      setAccessDenied(true);
      setSession(null);
      setReady(true);
      if (pendingSignOut) {
        return;
      }
      pendingSignOut = true;
      // signOut inside onAuthStateChange can deadlock the supabase-js client.
      window.setTimeout(() => {
        supabase.auth.signOut({ scope: "local" }).finally(() => {
          pendingSignOut = false;
        });
      }, 0);
    }

    function applySession(next) {
      if (ignore) {
        return;
      }
      if (next?.user?.id && !sessionIsAllowed(next)) {
        markAccessDenied();
        return;
      }
      if (next?.user?.id) {
        persistAccessDenied(false);
        setAccessDenied(false);
        clearOAuthCallbackParams();
        setSession(next);
        setReady(true);
        return;
      }
      setSession(null);
      if (oauthCallbackError() || !hasOAuthCallbackParams()) {
        if (oauthCallbackError()) {
          clearOAuthCallbackParams();
        }
        setReady(true);
      }
    }

    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      applySession(next);
    });

    supabase.auth.getSession().then(({ data: sessionData }) => {
      applySession(sessionData.session ?? null);
    });

    return () => {
      ignore = true;
      window.clearTimeout(readyTimeout);
      data.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo(
    () => ({
      ready,
      session,
      user: session?.user ?? null,
      configured: Boolean(supabase),
      accessDenied,
      clearAccessDenied() {
        persistAccessDenied(false);
        setAccessDenied(false);
      },
      signIn(email, password) {
        if (!supabase) {
          return Promise.reject(new Error("Supabase is not configured."));
        }
        return supabase.auth.signInWithPassword({ email, password }).then((result) => {
          if (result.error) {
            return result;
          }
          if (result.data?.session && !sessionIsAllowed(result.data.session)) {
            rejectDisallowedSession();
            setAccessDenied(true);
            setSession(null);
            return supabase.auth.signOut({ scope: "local" }).then(() => ({
              data: { session: null, user: null },
              error: null,
            }));
          }
          persistAccessDenied(false);
          setAccessDenied(false);
          return result;
        });
      },
      signOut() {
        if (!supabase) {
          return Promise.resolve();
        }
        return supabase.auth.signOut({ scope: "local" });
      },
      signInWithGoogle() {
        if (!supabase) {
          return Promise.reject(new Error("Supabase is not configured."));
        }
        persistAccessDenied(false);
        setAccessDenied(false);
        return supabase.auth
          .signInWithOAuth({
            provider: "google",
            options: {
              redirectTo: webOAuthRedirectTo(),
              queryParams: { prompt: "select_account" },
              skipBrowserRedirect: true,
            },
          })
          .then((result) => {
            if (result.error) {
              return result;
            }
            if (result.data?.url) {
              window.location.assign(result.data.url);
            }
            return result;
          });
      },
    }),
    [ready, session, accessDenied]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const auth = useContext(AuthContext);
  if (!auth) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return auth;
}
