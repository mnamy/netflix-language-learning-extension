import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

export function AppLayout() {
  const { user, signOut } = useAuth();

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
