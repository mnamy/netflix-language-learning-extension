import { Navigate, NavLink, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

export function AppLayout() {
  const { user, signOut, accessDenied } = useAuth();
  const location = useLocation();

  if (accessDenied && location.pathname !== "/sign-in") {
    return <Navigate to="/sign-in" replace />;
  }

  return (
    <div className="app">
      <header className="top">
        <p className="brand">Language Learner</p>
        <nav className="nav">
          <NavLink to="/" end>
            Dashboard
          </NavLink>
          <NavLink to="/words">Words</NavLink>
          <NavLink to="/review">Review</NavLink>
          {user ? (
            <button type="button" className="linkish" onClick={() => signOut()}>
              Sign out
            </button>
          ) : (
            <NavLink to="/sign-in">Sign in</NavLink>
          )}
        </nav>
      </header>
      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}
