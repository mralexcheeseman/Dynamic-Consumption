// Deterministic "hand" for each page: the same post always gets the same
// wobble, marks and objects, so it reads like one physical sheet.

export function hash(n) {
  return (Math.imul(n | 0, 2654435761) >>> 0) % 9973;
}

// Typewriter words: each one sits a little off the line (±1.2px, ±0.66°),
// with uneven ribbon ink.
export function Typed({ text, salt = 1 }) {
  const words = text.split(/\s+/).filter(Boolean);
  return words.map((w, i) => {
    const r = hash(salt * 131 + i * 31 + 7);
    const y = ((r % 5) - 2) * 0.6;
    const rot = ((r % 7) - 3) * 0.22;
    const ink = 0.82 + ((r >> 3) % 19) / 100;
    return (
      <span key={i}>
        <span className="dc-w" style={{ transform: `translateY(${y}px) rotate(${rot}deg)`, opacity: ink }}>{w}</span>
        {i < words.length - 1 ? " " : ""}
      </span>
    );
  });
}

// A paragraph, with the day's highlighted line marked if it falls inside it.
export function TypedPara({ text, highlight, salt, variant, note }) {
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
      {note}
    </p>
  );
}

// Scanned margin notes, by file, at their natural width in pixels.
// Drawn at 0.025rem per pixel so the hand comes out at typing size.
const NOTE_WIDTHS = {"note-1": 494, "note-2": 374, "note-3": 270, "note-4": 273, "note-5": 373, "note-6": 238, "note-7": 382, "note-8": 464, "note-9": 546, "note-10": 258, "note-11": 475, "note-12": 462, "note-13": 348, "note-14": 407, "note-about": 445};

// Uploaded notes carry their own width (they are normalised to one 110px line on upload).
export function MarginNote({ src, alt, seed = 1, width }) {
  if (!src) return null;
  const key = src.split("/").pop().replace(".webp", "");
  const px = width || NOTE_WIDTHS[key] || 380;
  const r = hash(seed * 53 + 5);
  return (
    <img
      className="dc-note"
      src={src}
      alt={alt ? `Margin note: ${alt}` : ""}
      style={{ width: `${(px * 0.025).toFixed(2)}rem`, transform: `rotate(${-1 - (r % 4) * 0.7}deg)`, marginRight: `${(r % 3) * 0.8}rem` }}
    />
  );
}

// Coffee only ever bleeds in from an edge, never over the title or the highlight.
const coffeeSlots = [
  { right: "-7rem", bottom: "-6rem" },
  { left: "-7.5rem", bottom: "-5rem" },
  { right: "-8rem", top: "40%" },
];

// What a page picked up while it sat on the desk.
export function sheetMarks(n) {
  const r = hash(n * 97 + 13);
  return {
    tilt: (((r % 9) - 4) * 0.16).toFixed(2),
    alt: r % 2 === 1,
    highlight: 1,
    clipRot: -8 - (r % 9),
    coffee: n % 3 === 0 ? { src: `coffee-${(r % 3) + 1}`, pos: coffeeSlots[r % coffeeSlots.length], rot: r % 360 } : null,
    receipt: n % 4 === 2 ? (r % 2 ? "r" : "l") : null,
    sticker: n % 7 === 4,
    ring: n % 5 === 1,
  };
}

export function Coffee({ mark }) {
  if (!mark) return null;
  return (
    <img
      className="dc-mark"
      src={`/assets/${mark.src}.webp`}
      alt=""
      aria-hidden="true"
      style={{ ...mark.pos, width: "17rem", opacity: 0.5, transform: `rotate(${mark.rot}deg)` }}
    />
  );
}

// The SVG ink filter used on typed headlines: a hair of bleed along the strokes.
export function InkFilter() {
  return (
    <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true">
      <filter id="dc-ink">
        <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="11" result="n" />
        <feDisplacementMap in="SourceGraphic" in2="n" scale="1.6" xChannelSelector="R" yChannelSelector="G" />
      </filter>
    </svg>
  );
}
