import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [ready, setReady] = useState(!supabase);

  useEffect(() => {
    if (!supabase) {
      return;
    }

    let ignore = false;

    supabase.auth.getSession().then(({ data }) => {
      if (!ignore) {
        setSession(data.session ?? null);
        setReady(true);
      }
    });

    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
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
      signIn(email, password) {
        if (!supabase) {
          return Promise.reject(new Error("Supabase is not configured."));
        }
        return supabase.auth.signInWithPassword({ email, password });
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
            redirectTo: window.location.origin + "/sign-in",
          },
        });
      },
    }),
    [ready, session]
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
