import { Link } from "react-router-dom";
import { pad, shortDate, todayIso } from "@/components/Sheet";

// The running list of pages, typed straight onto the desk.
export default function Ledger({ posts }) {
  const today = todayIso();
  return (
    <ul className="dc-ledger">
      {posts.map((p) => (
        <li key={p.id ?? p.number}>
          <Link to={`/p/${p.number}`}>
            <span className="n">{pad(p.number)}</span>
            <span className="t">
              {p.title}
              {p.published_on === today && <span className="today">today</span>}
            </span>
            <span className="d">{shortDate(p.published_on)}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
