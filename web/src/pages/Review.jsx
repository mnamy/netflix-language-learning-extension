import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  afterCorrectReview,
  afterIncorrectReview,
  dueQueue,
  masteredList,
  normalizeStatus,
} from "../lib/reviewSchedule";
import { fetchSavedWords, updateReviewProgress } from "../lib/savedWords";

function advanceQueue(list, cardId, graded) {
  const rest = [];
  for (let i = 0; i < list.length; i++) {
    if (list[i].id !== cardId) {
      rest.push(list[i]);
    }
  }
  if (graded && new Date(graded.next_review_at).getTime() <= Date.now()) {
    rest.push(graded);
  }
  return rest;
}

export function Review() {
  const [allWords, setAllWords] = useState([]);
  const [queue, setQueue] = useState([]);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [mode, setMode] = useState("toEnglish");
  const [practiceMastered, setPracticeMastered] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  function applyList(list, masteredPractice) {
    setAllWords(list);
    setQueue(masteredPractice ? masteredList(list) : dueQueue(list));
    setIndex(0);
    setFlipped(false);
  }

  useEffect(() => {
    let ignore = false;
    fetchSavedWords()
      .then((list) => {
        if (!ignore) {
          applyList(list, false);
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
  const masteredCount = masteredList(allWords).length;

  async function grade(knew) {
    if (!card || saving) {
      return;
    }
    setSaving(true);
    const patch = knew ? afterCorrectReview(card) : afterIncorrectReview();
    const cardId = card.id;
    const graded = { ...card, ...patch };
    try {
      await updateReviewProgress(cardId, patch);
      setAllWords((current) =>
        current.map((item) => (item.id === cardId ? graded : item))
      );
      setQueue((current) => advanceQueue(current, cardId, graded));
      setIndex(0);
      setFlipped(false);
    } catch (err) {
      setError(err.message || "Could not update status");
    } finally {
      setSaving(false);
    }
  }

  function startMasteredPractice() {
    setPracticeMastered(true);
    setQueue(masteredList(allWords));
    setIndex(0);
    setFlipped(false);
  }

  function startDueReview() {
    setPracticeMastered(false);
    setQueue(dueQueue(allWords));
    setIndex(0);
    setFlipped(false);
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
        {practiceMastered ? (
          <p className="lede">
            No mastered words to practice. Mastered cards stay in the word bank
            and return here when their next review is due.
          </p>
        ) : (
          <p className="lede">
            You are caught up for today. Mastered words stay in the word bank
            and come back later for spaced review.
          </p>
        )}
        <p className="actions">
          {!practiceMastered && masteredCount > 0 && (
            <button type="button" className="text-action" onClick={startMasteredPractice}>
              Review mastered
            </button>
          )}
          {practiceMastered && (
            <button type="button" className="text-action" onClick={startDueReview}>
              Back to due cards
            </button>
          )}
          <Link to="/words">Open word bank</Link>
        </p>
      </section>
    );
  }

  return (
    <section className="review">
      <h1>Review</h1>
      <p className="lede">
        {practiceMastered
          ? "Practicing mastered words. A miss sends the card back to learning."
          : "Cards due today. A correct answer schedules the next review later, so the same sitting cannot mark a word mastered."}
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
      {!practiceMastered && masteredCount > 0 && (
        <p className="actions">
          <button type="button" className="text-action" onClick={startMasteredPractice}>
            Review mastered
          </button>
        </p>
      )}
      {practiceMastered && (
        <p className="actions">
          <button type="button" className="text-action" onClick={startDueReview}>
            Back to due cards
          </button>
        </p>
      )}
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
        {practiceMastered ? " · mastered practice" : " due"}
      </p>
    </section>
  );
}
