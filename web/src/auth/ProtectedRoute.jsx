import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "./AuthContext";

export function ProtectedRoute({ children }) {
  const { ready, user } = useAuth();
  const location = useLocation();

  if (!ready) {
    return <p className="lede">Checking sign-in…</p>;
  }

  if (!user) {
    return <Navigate to="/sign-in" replace state={{ from: location.pathname }} />;
  }

  return children;
}
