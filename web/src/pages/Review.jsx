import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchSavedWords, updateLearningStatus } from "../lib/savedWords";

function normalizeStatus(status) {
  if (status === "learned") {
    return "mastered";
  }
  return status || "new";
}

function nextStatus(current, knew) {
  const status = normalizeStatus(current);
  if (!knew) {
    return "learning";
  }
  if (status === "new") {
    return "learning";
  }
  return "mastered";
}

function reviewQueue(list) {
  return list.filter((item) => normalizeStatus(item.learning_status) !== "mastered");
}

function advanceQueue(list, cardId, status) {
  const rest = [];
  let graded = null;
  for (let i = 0; i < list.length; i++) {
    const item = list[i];
    if (item.id === cardId) {
      graded = { ...item, learning_status: status };
    } else {
      rest.push(item);
    }
  }
  if (graded && normalizeStatus(graded.learning_status) !== "mastered") {
    rest.push(graded);
  }
  return reviewQueue(rest);
}

export function Review() {
  const [queue, setQueue] = useState([]);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [mode, setMode] = useState("toEnglish");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let ignore = false;
    fetchSavedWords()
      .then((list) => {
        if (!ignore) {
          setQueue(reviewQueue(list));
          setIndex(0);
          setFlipped(false);
        }
      })
      .catch((err) => {
        if (!ignore) {
          setError(err.message || "Could not load words");
        }
      })
      .finally(() => {
        if (!ignore) {
          setLoading(false);
        }
      });
    return () => {
      ignore = true;
    };
  }, []);

  const card = queue[index];
  const reverse = mode === "toForeign";
  const front = reverse ? card?.translation : card?.word;
  const back = reverse ? card?.word : card?.translation;

  async function grade(knew) {
    if (!card || saving) {
      return;
    }
    setSaving(true);
    const status = nextStatus(card.learning_status, knew);
    const cardId = card.id;
    try {
      await updateLearningStatus(cardId, status);
      setQueue((current) => advanceQueue(current, cardId, status));
      setIndex(0);
      setFlipped(false);
    } catch (err) {
      setError(err.message || "Could not update status");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <section>
        <h1>Review</h1>
        <p className="lede">Loading your words…</p>
      </section>
    );
  }

  if (error) {
    return (
      <section>
        <h1>Review</h1>
        <p className="auth-error">{error}</p>
      </section>
    );
  }

  if (!card) {
    return (
      <section className="review-done">
        <h1>Review</h1>
        <p className="lede">
          No cards left to review. Save words from Netflix or open the word
          bank.
        </p>
        <p className="actions">
          <Link to="/words">Open word bank</Link>
        </p>
      </section>
    );
  }

  return (
    <section className="review">
      <h1>Review</h1>
      <p className="lede">
        Click the card to flip it. Missed keeps it in the pile. Knew twice
        marks it mastered and skips it.
      </p>
      <div className="review-mode" role="group" aria-label="Review direction">
        <button
          type="button"
          className={mode === "toEnglish" ? "is-active" : ""}
          onClick={() => {
            setMode("toEnglish");
            setFlipped(false);
          }}
        >
          Word → English
        </button>
        <button
          type="button"
          className={mode === "toForeign" ? "is-active" : ""}
          onClick={() => {
            setMode("toForeign");
            setFlipped(false);
          }}
        >
          English → Word
        </button>
      </div>
      <button
        type="button"
        className={"card" + (flipped ? " is-flipped" : "")}
        onClick={() => setFlipped((value) => !value)}
      >
        <span className="card-kicker">
          {flipped
            ? reverse
              ? "Word"
              : "Translation"
            : reverse
              ? "Translation"
              : "Word"}
        </span>
        <strong>{flipped ? back : front}</strong>
        <span className="card-meta">
          {[card.source_language, normalizeStatus(card.learning_status)]
            .filter(Boolean)
            .join(" · ")}
        </span>
        <span className="card-hint">{flipped ? "Click to hide" : "Click to flip"}</span>
      </button>
      <div className="review-grade">
        <button
          type="button"
          className="missed"
          disabled={saving}
          onClick={() => grade(false)}
        >
          I missed this
        </button>
        <button
          type="button"
          className="knew"
          disabled={saving}
          onClick={() => grade(true)}
        >
          I knew this
        </button>
      </div>
      <p className="card-progress">
        {queue.length} card{queue.length === 1 ? "" : "s"} left
      </p>
    </section>
  );
}
