import { useEffect, useMemo, useState } from "react";
import {
  deleteSavedWord,
  fetchSavedWords,
  updateLearningStatus,
} from "../lib/savedWords";
import { conjugatePresent } from "../lib/spanishPresent";
import { patchForManualStatus } from "../lib/reviewSchedule";

const STATUSES = ["new", "learning", "mastered"];

function isVerb(item) {
  return String(item.part_of_speech || "").toLowerCase() === "verb";
}

export function Words() {
  const [words, setWords] = useState([]);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("newest");
  const [tab, setTab] = useState("all");
  const [openVerb, setOpenVerb] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setError("");
    setLoading(true);
    try {
      setWords(await fetchSavedWords());
    } catch (err) {
      setError(err.message || "Could not load words");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const source = tab === "verbs" ? words.filter(isVerb) : words;
    const filtered = source.filter((item) => {
      if (!needle) {
        return true;
      }
      return [item.word, item.translation, item.source_language]
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });

    return filtered.sort((a, b) => {
      const left = new Date(a.created_at).getTime();
      const right = new Date(b.created_at).getTime();
      if (sort === "oldest") {
        return left - right;
      }
      if (sort === "az") {
        return String(a.word).localeCompare(String(b.word));
      }
      return right - left;
    });
  }, [words, query, sort, tab]);

  async function onStatus(id, status) {
    const previous = words;
    setWords((list) =>
      list.map((item) =>
        item.id === id ? { ...item, ...patchForManualStatus(status) } : item
      )
    );
    try {
      await updateLearningStatus(id, status);
    } catch (err) {
      setWords(previous);
      setError(err.message || "Could not update status");
    }
  }

  async function onDelete(item) {
    if (!window.confirm("Delete “" + item.word + "”?")) {
      return;
    }
    const previous = words;
    setWords((list) => list.filter((row) => row.id !== item.id));
    try {
      await deleteSavedWord(item.id);
    } catch (err) {
      setWords(previous);
      setError(err.message || "Could not delete word");
    }
  }

  const verbCount = words.filter(isVerb).length;

  return (
    <section>
      <h1>Word bank</h1>
      <p className="lede">The same account word bank as the Netflix extension.</p>

      <div className="review-mode" role="tablist" aria-label="Word bank views">
        <button
          type="button"
          role="tab"
          className={tab === "all" ? "is-active" : ""}
          onClick={() => setTab("all")}
        >
          All words
        </button>
        <button
          type="button"
          role="tab"
          className={tab === "verbs" ? "is-active" : ""}
          onClick={() => setTab("verbs")}
        >
          Verbs
        </button>
      </div>

      <div className="toolbar">
        <input
          type="search"
          placeholder={tab === "verbs" ? "Search verbs" : "Search words"}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <label className="sort">
          Sort
          <select value={sort} onChange={(event) => setSort(event.target.value)}>
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
            <option value="az">A–Z</option>
          </select>
        </label>
      </div>

      {error && <p className="auth-error">{error}</p>}
      {loading && <p className="lede">Loading words…</p>}
      {!loading && tab === "verbs" && verbCount === 0 && (
        <p className="lede">
          No saved verbs yet. New verb saves from Netflix will show up here.
          Older rows without a part of speech stay in All words.
        </p>
      )}
      {!loading && tab === "all" && visible.length === 0 && (
        <p className="lede">No saved words yet.</p>
      )}
      {!loading && tab === "verbs" && verbCount > 0 && visible.length === 0 && (
        <p className="lede">No verbs match that search.</p>
      )}

      {!loading && tab === "all" && visible.length > 0 && (
        <table className="table">
          <thead>
            <tr>
              <th>Word</th>
              <th>Translation</th>
              <th>Language</th>
              <th>Status</th>
              <th>Seen</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {visible.map((item) => (
              <tr key={item.id}>
                <td>{item.word}</td>
                <td>{item.translation}</td>
                <td>{item.source_language || "—"}</td>
                <td>
                  <select
                    className={"status status-" + item.learning_status}
                    value={
                      item.learning_status === "learned"
                        ? "mastered"
                        : item.learning_status
                    }
                    onChange={(event) => onStatus(item.id, event.target.value)}
                  >
                    {STATUSES.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </td>
                <td>{item.times_seen || 1}</td>
                <td>
                  <button
                    type="button"
                    className="row-delete"
                    onClick={() => onDelete(item)}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {!loading && tab === "verbs" && visible.length > 0 && (
        <ul className="verb-list">
          {visible.map((item) => {
            const open = openVerb === item.id;
            const present = conjugatePresent(item.word);
            return (
              <li key={item.id} className="verb-card">
                <div className="verb-head">
                  <div>
                    <p className="word">{item.word}</p>
                    <p className="meaning">{item.translation}</p>
                  </div>
                  <button
                    type="button"
                    className="verb-toggle"
                    onClick={() =>
                      setOpenVerb(open ? "" : item.id)
                    }
                  >
                    {open ? "Hide present" : "Present tense"}
                  </button>
                </div>
                {open && (
                  <table className="table conj-table">
                    <tbody>
                      {present.persons.map((person) => (
                        <tr key={person.id}>
                          <th>{person.label}</th>
                          <td>{person.form}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
