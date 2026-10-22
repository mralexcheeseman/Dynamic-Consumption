// Deterministic "hand" for each page: the same post always gets the same
// wobble, ink and marks, so it reads like one physical sheet, not a random effect.

export function hash(n) {
  return ((n * 2654435761) >>> 0) % 9973;
}

// Typewriter words: each one sits a little off the line, with uneven ribbon ink.
export function Typed({ text, salt = 1 }) {
  const words = text.split(/\s+/).filter(Boolean);
  return words.map((w, i) => {
    const r = hash(salt * 131 + i * 31 + 7);
    const y = ((r % 5) - 2) * 0.45;
    const rot = ((r % 7) - 3) * 0.18;
    const ink = 0.8 + ((r >> 3) % 21) / 100;
    return (
      <span key={i}>
        <span className="dc-w" style={{ transform: `translateY(${y}px) rotate(${rot}deg)`, opacity: ink }}>{w}</span>
        {i < words.length - 1 ? " " : ""}
      </span>
    );
  });
}

// A paragraph, with the day's highlighted line marked if it falls inside it.
export function TypedPara({ text, highlight, salt, variant }) {
  const at = highlight ? text.indexOf(highlight) : -1;
  if (at < 0) return <p><Typed text={text} salt={salt} /></p>;
  const before = text.slice(0, at).trimEnd();
  const after = text.slice(at + highlight.length).trimStart();
  const glue = (s) => (s && !/^[.,;:!?)]/.test(s) ? " " : "");
  return (
    <p>
      {before && <><Typed text={before} salt={salt} />{" "}</>}
      <span className={`dc-hl v${variant}`}><Typed text={highlight} salt={salt + 50} /></span>
      {after && <>{glue(after)}<Typed text={after} salt={salt + 90} /></>}
    </p>
  );
}

const corners = [
  { right: "-8rem", top: "9rem" },
  { left: "-8rem", bottom: "5rem" },
  { right: "-6rem", bottom: "-5rem" },
  { left: "-7rem", top: "-6rem" },
];

// The marks a page picks up while it sits on the desk.
export function sheetMarks(n) {
  const r = hash(n * 97 + 13);
  return {
    tilt: (((r % 9) - 4) * 0.14).toFixed(2),
    alt: r % 2 === 1,
    highlight: r % 3 === 0 ? 1 : 3,
    tapeL: r % 2 ? "tape-1" : "tape-2",
    tapeR: r % 2 ? "tape-2" : "tape-1",
    coffee: n % 3 === 0 ? { src: `coffee-${(r % 3) + 1}`, pos: corners[r % corners.length], rot: r % 360 } : null,
    circleStamp: n % 4 === 1,
  };
}

export function Coffee({ mark }) {
  if (!mark) return null;
  return (
    <img
      className="dc-mark"
      src={`/assets/${mark.src}.webp`}
      alt=""
      style={{ ...mark.pos, width: "16rem", opacity: 0.45, transform: `rotate(${mark.rot}deg)` }}
    />
  );
}
