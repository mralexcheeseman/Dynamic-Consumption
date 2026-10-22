import { useEffect } from "react";
import { Link } from "react-router-dom";

export function useDocTitle(title) {
  useEffect(() => {
    document.title = title ? `${title} | Dynamic Consumption` : "Dynamic Consumption";
  }, [title]);
}

export function pad(n) {
  return String(n ?? 0).padStart(3, "0");
}

export function longDate(iso) {
  if (!iso) return "";
  const d = new Date(iso + "T12:00:00");
  return d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

export function shortDate(iso) {
  if (!iso) return "";
  const d = new Date(iso + "T12:00:00");
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "2-digit" }).replace(/\//g, ".");
}

export function todayIso() {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

// The desk everything sits on: Dymo-label masthead, then the page.
export default function Desk({ children }) {
  useEffect(() => {
    document.body.classList.add("dc");
    return () => document.body.classList.remove("dc");
  }, []);

  return (
    <div className="dc-desk">
      <header className="dc-mast">
        <Link to="/" className="dc-dymo" aria-label="Dynamic Consumption, today's page">Dynamic Consumption</Link>
        <nav className="dc-nav">
          <Link to="/archive">archive</Link>
          <Link to="/about">about</Link>
        </nav>
      </header>
      <main>{children}</main>
    </div>
  );
}

// One sheet of paper, taped down, with whatever has been spilt on it.
export function Paper({ marks, children, className = "" }) {
  return (
    <div
      className={`dc-sheet dc-drop ${marks.alt ? "alt" : ""} ${className}`}
      style={{ "--tilt": `${marks.tilt}deg`, transform: `rotate(${marks.tilt}deg)` }}
    >
      <img className="dc-tape l" src={`/assets/${marks.tapeL}.webp`} alt="" />
      <img className="dc-tape r" src={`/assets/${marks.tapeR}.webp`} alt="" />
      {children}
    </div>
  );
}
