import { useEffect, useMemo, useState } from "react";
import {
  deleteSavedWord,
  fetchSavedWords,
  updateLearningStatus,
} from "../lib/savedWords";

const STATUSES = ["new", "learning", "learned"];

export function Words() {
  const [words, setWords] = useState([]);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("newest");
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
    const filtered = words.filter((item) => {
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
  }, [words, query, sort]);

  async function onStatus(id, status) {
    const previous = words;
    setWords((list) =>
      list.map((item) =>
        item.id === id ? { ...item, learning_status: status } : item
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

  return (
    <section>
      <h1>Word bank</h1>
      <p className="lede">Your saved words from Supabase. No extension sync yet.</p>

      <div className="toolbar">
        <input
          type="search"
          placeholder="Search words"
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
      {!loading && visible.length === 0 && (
        <p className="lede">No saved words yet.</p>
      )}

      {!loading && visible.length > 0 && (
        <table className="table">
          <thead>
            <tr>
              <th>Word</th>
              <th>Translation</th>
              <th>Language</th>
              <th>Status</th>
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
                    value={item.learning_status}
                    onChange={(event) => onStatus(item.id, event.target.value)}
                  >
                    {STATUSES.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </td>
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
    </section>
  );
}
