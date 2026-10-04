import { Link } from "react-router-dom";
import { fakeWords } from "../data/fakeWords";

export function Dashboard() {
  const learning = fakeWords.filter((item) => item.status === "learning").length;
  const learned = fakeWords.filter((item) => item.status === "learned").length;

  return (
    <section>
      <h1>Dashboard</h1>
      <p className="lede">
        Local practice site for words you save from Netflix. Data here is fake
        until sync is added.
      </p>
      <ul className="stats">
        <li>
          <strong>{fakeWords.length}</strong>
          <span>saved words</span>
        </li>
        <li>
          <strong>{learning}</strong>
          <span>learning</span>
        </li>
        <li>
          <strong>{learned}</strong>
          <span>learned</span>
        </li>
      </ul>
      <p className="actions">
        <Link to="/words">Open word bank</Link>
        <Link to="/review">Start flashcards</Link>
      </p>
    </section>
  );
}
