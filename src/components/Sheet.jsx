import { useEffect } from "react";
import { Link, NavLink } from "react-router-dom";
import { InkFilter } from "@/components/marks";

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

// The desk everything sits on: the Dymo label, then the page.
export default function Desk({ children }) {
  useEffect(() => {
    document.body.classList.add("dc");
    return () => document.body.classList.remove("dc");
  }, []);

  return (
    <div className="dc-desk">
      <InkFilter />
      <header className="dc-mast">
        <Link to="/" className="dc-dymo">
          <img src="/assets/dymo.webp" alt="Dynamic Consumption" width="900" height="149" />
        </Link>
        <nav className="dc-nav" aria-label="Main">
          <NavLink to="/archive">Archive</NavLink>
          <NavLink to="/about">About</NavLink>
        </nav>
      </header>
      <main>{children}</main>
    </div>
  );
}

// One sheet of paper: paper-clipped, with whatever it picked up on the desk.
export function Paper({ marks, children, className = "" }) {
  return (
    <div className="dc-stack">
      {marks.receipt && <img className={`dc-under dc-receipt ${marks.receipt}`} src="/assets/receipt.webp" alt="" aria-hidden="true" />}
      <div
        className={`dc-sheet dc-drop ${marks.alt ? "alt" : ""} ${marks.sticker ? "has-sticker" : ""} ${className}`}
        style={{ "--tilt": `${marks.tilt}deg`, transform: `rotate(${marks.tilt}deg)` }}
      >
        <img className="dc-obj dc-clip" style={{ transform: `rotate(${marks.clipRot}deg)` }} src="/assets/paperclip.webp" alt="" aria-hidden="true" />
        {marks.sticker && <img className="dc-obj dc-sticker" src="/assets/sticker.webp" alt="" aria-hidden="true" />}
        {children}
      </div>
    </div>
  );
}
