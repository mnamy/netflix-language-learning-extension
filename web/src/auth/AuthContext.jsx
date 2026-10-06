import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { oauthLanding, supabase } from "../lib/supabase";

const AuthContext = createContext(null);

const ACCESS_DENIED_KEY = "nflxAccessDenied";

function webOAuthRedirectTo() {
  return window.location.origin + "/sign-in";
}

function allowedUserId() {
  return String(import.meta.env.VITE_ALLOWED_USER_ID || "").trim();
}

function userIdFromJwt(token) {
  const raw = String(token || "");
  const parts = raw.split(".");
  if (parts.length < 2) {
    return "";
  }
  try {
    const padded = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const json = atob(padded);
    const payload = JSON.parse(json);
    return String(payload.sub || "").trim();
  } catch (err) {
    return "";
  }
}

function identityFromSession(session) {
  return String(session?.user?.id || userIdFromJwt(session?.access_token) || "").trim();
}

function sessionIsAllowed(session) {
  const allowed = allowedUserId();
  const identity = identityFromSession(session);
  if (!allowed || !identity) {
    return true;
  }
  return identity === allowed;
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

function persistAccessDenied(denied) {
  storageSet(ACCESS_DENIED_KEY, denied);
}

function isUserCancelledOAuth(landing) {
  const desc = String(landing.errorDescription || landing.error || "").toLowerCase();
  return desc.includes("cancel") || desc.includes("dismiss");
}

function isPrivateAccessOAuth(landing) {
  if (!landing || isUserCancelledOAuth(landing)) {
    return false;
  }
  const code = String(landing.errorCode || "").toLowerCase();
  const desc = String(landing.errorDescription || "").toLowerCase();
  const err = String(landing.error || "").toLowerCase();
  if (
    code === "signup_disabled" ||
    code === "user_banned" ||
    code === "forbidden" ||
    desc.includes("signup") ||
    desc.includes("not allowed") ||
    desc.includes("banned")
  ) {
    return true;
  }
  const allowed = allowedUserId();
  const tokenUser = userIdFromJwt(landing.accessToken);
  if (allowed && tokenUser && tokenUser !== allowed) {
    return true;
  }
  // A completed Google trip that Supabase rejected without a session.
  if ((err || code || desc) && (landing.code || landing.accessToken || err === "access_denied" || err === "server_error")) {
    if (err === "access_denied" && !code && !desc) {
      return false;
    }
    if (err === "access_denied" || err === "server_error") {
      return true;
    }
  }
  return false;
}

function hasOAuthCallbackParams(landing) {
  return Boolean(
    landing.code ||
      landing.accessToken ||
      landing.error ||
      landing.errorCode ||
      landing.errorDescription
  );
}

function clearOAuthCallbackParams() {
  if (typeof window === "undefined") {
    return;
  }
  if (!window.location.search && !window.location.hash) {
    return;
  }
  window.history.replaceState({}, "", window.location.pathname);
}

function rejectDisallowedSession() {
  persistAccessDenied(true);
  clearOAuthCallbackParams();
}

const landingDenied = isPrivateAccessOAuth(oauthLanding);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [ready, setReady] = useState(!supabase);
  const [accessDenied, setAccessDenied] = useState(
    () => storageGet(ACCESS_DENIED_KEY) || landingDenied
  );

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

    if (landingDenied) {
      markAccessDenied();
    }

    function applySession(next) {
      if (ignore) {
        return;
      }
      if (next && !sessionIsAllowed(next)) {
        markAccessDenied();
        return;
      }
      if (identityFromSession(next)) {
        persistAccessDenied(false);
        setAccessDenied(false);
        clearOAuthCallbackParams();
        setSession(next);
        setReady(true);
        return;
      }
      if (isPrivateAccessOAuth(oauthLanding)) {
        markAccessDenied();
        return;
      }
      setSession(null);
      if (isUserCancelledOAuth(oauthLanding) || !hasOAuthCallbackParams(oauthLanding)) {
        if (isUserCancelledOAuth(oauthLanding)) {
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
            const message = String(result.error.message || "").toLowerCase();
            if (message.includes("signup") || message.includes("not allowed")) {
              rejectDisallowedSession();
              setAccessDenied(true);
              setSession(null);
              return { data: { session: null, user: null }, error: null };
            }
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
              const message = String(result.error.message || "").toLowerCase();
              if (message.includes("signup") || message.includes("not allowed")) {
                rejectDisallowedSession();
                setAccessDenied(true);
                return { data: result.data, error: null };
              }
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
