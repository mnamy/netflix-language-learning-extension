import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

const AuthContext = createContext(null);

function webOAuthRedirectTo() {
  const fromEnv = String(import.meta.env.VITE_APP_URL || "")
    .trim()
    .replace(/\/$/, "");
  if (fromEnv) {
    return fromEnv + "/sign-in";
  }
  if (import.meta.env.DEV) {
    return "http://localhost:5173/sign-in";
  }
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

const ACCESS_DENIED_KEY = "nflxAccessDenied";

function readAccessDenied() {
  try {
    return sessionStorage.getItem(ACCESS_DENIED_KEY) === "1";
  } catch (err) {
    return false;
  }
}

function persistAccessDenied(denied) {
  try {
    if (denied) {
      sessionStorage.setItem(ACCESS_DENIED_KEY, "1");
    } else {
      sessionStorage.removeItem(ACCESS_DENIED_KEY);
    }
  } catch (err) {
    // sessionStorage can be unavailable in some browser modes.
  }
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

    function markAccessDenied() {
      persistAccessDenied(true);
      if (!ignore) {
        setAccessDenied(true);
      }
    }

    function clearDeniedIfAllowedUser(next) {
      if (next?.user?.id && sessionIsAllowed(next)) {
        persistAccessDenied(false);
        if (!ignore) {
          setAccessDenied(false);
        }
      }
    }

    async function applySession(next) {
      if (next?.user?.id && !sessionIsAllowed(next)) {
        markAccessDenied();
        await supabase.auth.signOut({ scope: "local" });
        if (!ignore) {
          setSession(null);
          setReady(true);
        }
        return;
      }
      if (!ignore) {
        clearDeniedIfAllowedUser(next);
        setSession(next ?? null);
        setReady(true);
      }
    }

    supabase.auth.getSession().then(({ data }) => {
      return applySession(data.session ?? null);
    });

    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      applySession(next);
    });

    return () => {
      ignore = true;
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
            persistAccessDenied(true);
            setAccessDenied(true);
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
        return supabase.auth.signInWithOAuth({
          provider: "google",
          options: {
            redirectTo: webOAuthRedirectTo(),
            queryParams: { prompt: "select_account" },
          },
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
