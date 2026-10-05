import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { fetchSavedWords } from "../lib/savedWords";

function statusOf(item) {
  return item.learning_status === "learned" ? "mastered" : item.learning_status;
}

export function Dashboard() {
  const { user } = useAuth();
  const [words, setWords] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user) {
      setWords([]);
      setError("");
      return;
    }
    fetchSavedWords()
      .then((list) => {
        setWords(list);
        setError("");
      })
      .catch((err) => {
        setWords([]);
        setError(err.message || "Could not load words");
      });
  }, [user]);

  const learning = words.filter((item) => statusOf(item) === "learning").length;
  const mastered = words.filter((item) => statusOf(item) === "mastered").length;

  return (
    <section>
      <h1>Dashboard</h1>
      <p className="lede">
        {user
          ? "Practice words saved from Netflix."
          : "Sign in to see your word counts and review cards."}
      </p>
      {error && <p className="auth-error">{error}</p>}
      <ul className="stats">
        <li>
          <strong>{user && !error ? words.length : "—"}</strong>
          <span>saved words</span>
        </li>
        <li>
          <strong>{user && !error ? learning : "—"}</strong>
          <span>learning</span>
        </li>
        <li>
          <strong>{user && !error ? mastered : "—"}</strong>
          <span>mastered</span>
        </li>
      </ul>
      <p className="actions">
        <Link to="/words">Open word bank</Link>
        <Link to="/review">Start flashcards</Link>
      </p>
    </section>
  );
}
