import { useState } from "react";
import { fakeWords } from "../data/fakeWords";

export function Review() {
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const card = fakeWords[index];

  function next(delta) {
    setFlipped(false);
    setIndex((current) => {
      const nextIndex = current + delta;
      if (nextIndex < 0) {
        return fakeWords.length - 1;
      }
      if (nextIndex >= fakeWords.length) {
        return 0;
      }
      return nextIndex;
    });
  }

  return (
    <section>
      <h1>Review</h1>
      <p className="lede">
        Front is the saved word. Back is the English translation.
      </p>
      <button
        type="button"
        className={"card" + (flipped ? " is-flipped" : "")}
        onClick={() => setFlipped((value) => !value)}
      >
        <span className="card-kicker">{flipped ? "Translation" : "Word"}</span>
        <strong>{flipped ? card.translation : card.word}</strong>
        <span className="card-meta">
          {card.language} · {card.status}
        </span>
      </button>
      <div className="review-nav">
        <button type="button" onClick={() => next(-1)}>
          Previous
        </button>
        <span>
          {index + 1} / {fakeWords.length}
        </span>
        <button type="button" onClick={() => next(1)}>
          Next
        </button>
      </div>
    </section>
  );
}
