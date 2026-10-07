import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  dueQueue,
  masteredList,
  needsSessionPair,
  normalizeStatus,
  reviewSnapshotFields,
  SESSION_NEEDED,
  sessionAfterGrade,
} from "../lib/reviewSchedule";
import { fetchSavedWords, updateReviewProgress } from "../lib/savedWords";

export function Review() {
  const [allWords, setAllWords] = useState([]);
  const [queue, setQueue] = useState([]);
  const [sessionCounts, setSessionCounts] = useState({});
  const [undo, setUndo] = useState(null);
  const [flipped, setFlipped] = useState(false);
  const [mode, setMode] = useState("toEnglish");
  const [practiceMastered, setPracticeMastered] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  function applyList(list, masteredPractice) {
    setAllWords(list);
    setQueue(masteredPractice ? masteredList(list) : dueQueue(list));
    setSessionCounts({});
    setUndo(null);
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

  const card = queue[0];
  const reverse = mode === "toForeign";
  const front = reverse ? card?.translation : card?.word;
  const back = reverse ? card?.word : card?.translation;
  const masteredCount = masteredList(allWords).length;
  const sessionHits = card ? Number(sessionCounts[card.id] || 0) : 0;
  const showSessionPair = Boolean(card && !practiceMastered && needsSessionPair(card));

  async function grade(knew) {
    if (!card || saving) {
      return;
    }
    setSaving(true);
    const previous = {
      queue: queue,
      allWords: allWords,
      sessionCounts: sessionCounts,
      cardId: card.id,
      db: reviewSnapshotFields(card),
      persist: false,
    };
    const result = sessionAfterGrade({
      queue: queue,
      sessionCounts: sessionCounts,
      card: card,
      knew: knew,
      practiceMastered: practiceMastered,
    });
    try {
      if (result.persist) {
        await updateReviewProgress(card.id, result.persist);
        previous.persist = true;
      }
      setUndo(previous);
      setAllWords((current) =>
        current.map((item) => (item.id === card.id ? result.nextCard : item))
      );
      setQueue(result.queue);
      setSessionCounts(result.sessionCounts);
      setFlipped(false);
    } catch (err) {
      setError(err.message || "Could not update status");
    } finally {
      setSaving(false);
    }
  }

  async function undoLast() {
    if (!undo || saving) {
      return;
    }
    setSaving(true);
    try {
      if (undo.persist && undo.cardId && undo.db) {
        await updateReviewProgress(undo.cardId, undo.db);
      }
      setQueue(undo.queue);
      setAllWords(undo.allWords);
      setSessionCounts(undo.sessionCounts);
      setUndo(null);
      setFlipped(false);
    } catch (err) {
      setError(err.message || "Could not undo");
    } finally {
      setSaving(false);
    }
  }

  function startMasteredPractice() {
    setPracticeMastered(true);
    setQueue(masteredList(allWords));
    setSessionCounts({});
    setUndo(null);
    setFlipped(false);
  }

  function startDueReview() {
    setPracticeMastered(false);
    setQueue(dueQueue(allWords));
    setSessionCounts({});
    setUndo(null);
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
            You are caught up for today. New and learning cards need two spaced
            corrects in a session before they wait until the next due date.
          </p>
        )}
        <p className="actions">
          {undo && (
            <button type="button" className="text-action" onClick={undoLast}>
              ← Back
            </button>
          )}
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
          : "New and learning cards need two spaced corrects today. That does not master them."}
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
          {[
            card.source_language,
            normalizeStatus(card.learning_status),
            showSessionPair ? sessionHits + " of " + SESSION_NEEDED + " correct today" : "",
          ]
            .filter(Boolean)
            .join(" · ")}
        </span>
        <span className="card-hint">{flipped ? "Click to hide" : "Click to flip"}</span>
      </button>
      <div className="review-nav">
        <button type="button" disabled={!undo || saving} onClick={undoLast}>
          ← Back
        </button>
      </div>
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
        {queue.length} card{queue.length === 1 ? "" : "s"} in this session
        {practiceMastered ? " · mastered practice" : ""}
      </p>
    </section>
  );
}
