import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import Desk, { Paper, useDocTitle, pad, todayIso, longDate } from "@/components/Sheet";
import { sheetMarks } from "@/components/marks";
import { useSignature, DEFAULT_SIGNATURE, paragraphs } from "@/components/posts";
import Ledger from "@/components/Ledger";
import HandUpload from "@/components/HandUpload";

// The daily routine, in four steps. Nothing starts from a blank page:
// 1 Catch: something you consumed, in detail (any time of day, 30 seconds).
// 2 React: one or two lines on what you noticed. This is the page; the rest is shaping.
// 3 Shape: Note, Page or List, then "Draft it for me" or write it yourself.
// 4 Finish: edit on the sheet, tap the line to highlight, add a margin note, publish.

const STEPS = ["Catch", "React", "Shape", "Finish"];

const KINDS = [
  ["bought", "Bought"], ["read", "Read"], ["watched", "Watched"], ["ate", "Ate or drank"],
  ["used", "Used"], ["heard", "Overheard"], ["saw", "Saw"],
];

const SHAPES = {
  note: { name: "Note", size: "40 to 100 words", recipe: "One observation that turns once, then stops. No setup.", example: "No. 005, Nobody reads the second paragraph" },
  page: { name: "Page", size: "150 to 250 words", recipe: "The thing itself (what, where, how much). Then what you noticed. Then what it means for the reader. End on a short line.", example: "No. 006, Hotels are stories you can sleep in" },
  list: { name: "List", size: "4 to 6 items", recipe: "A short opening line, a few concrete items each with a dry aside, then a one-line verdict.", example: "No. 008, Things I didn't buy this week" },
};

const REACT_PROMPTS = [
  "What did you notice that most people wouldn't?",
  "What did it really cost you (not the price)?",
  "What does it say about how we buy, or why?",
  "What did you do that you'd tell a friend not to?",
];

const blank = {
  id: null, title: "", body: "", highlight: "", note: "", note_image: "", note_width: null,
  spark_id: "", spark: "", kind: "", reaction: "", shape: "page",
};

const noteSize = (px) => (px ? `${(px * 0.025).toFixed(2)}rem` : undefined);

const callFn = async (name, data) => {
  const res = await base44.functions.invoke(name, data);
  return res?.data ?? res ?? {};
};

// Sentences of the body, for tap-to-highlight.
// A sentence ends at . ? or ! followed by a space, so "£3.80" stays whole.
const sentencesOf = (body) =>
  paragraphs(body).flatMap((p) => p.split(/(?<=[.?!]["')\]]*)\s+/)).map((s) => s.trim()).filter((s) => s.length > 3);

export default function Write() {
  useDocTitle("Write");
  const { user, isAuthenticated, navigateToLogin } = useAuth();
  const qc = useQueryClient();
  const signature = useSignature();
  const [draft, setDraft] = useState(blank);
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [drafting, setDrafting] = useState(false);
  const [extras, setExtras] = useState({ endings: [], warnings: [], checks: [], redo: "" });
  const [newSpark, setNewSpark] = useState({ kind: "bought", text: "" });

  const isAdmin = user?.role === "admin";

  const { data: all = [] } = useQuery({
    queryKey: ["posts", "all"],
    queryFn: () => base44.entities.Post.list("-number", 1000),
    enabled: isAdmin,
  });
  const { data: sparks = [] } = useQuery({
    queryKey: ["sparks"],
    queryFn: () => base44.entities.Spark.filter({ status: "new" }, "-created_date", 100),
    enabled: isAdmin,
  });
  const { data: subCount } = useQuery({
    queryKey: ["subscribers", "count"],
    queryFn: async () => (await base44.entities.Subscriber.filter({ unsubscribed: false }, "-created_date", 5000)).length,
    enabled: isAdmin,
  });

  const drafts = all.filter((p) => p.status === "draft");
  const published = all.filter((p) => p.status === "published");
  const nextNumber = Math.max(0, ...all.map((p) => p.number || 0)) + 1;
  const words = draft.body.trim() ? draft.body.trim().split(/\s+/).length : 0;
  const sentences = useMemo(() => sentencesOf(draft.body), [draft.body]);
  const publishedToday = published.some((p) => p.published_on === todayIso());
  const set = (k) => (e) => setDraft({ ...draft, [k]: e.target.value });

  // Keep the work in progress in this browser in case the tab closes.
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("dc-desk") || "null");
      if (saved?.draft) {
        setDraft({ ...blank, ...saved.draft });
        setStep(saved.step || 0);
      }
    } catch { /* storage unavailable */ }
  }, []);
  useEffect(() => {
    try { localStorage.setItem("dc-desk", JSON.stringify({ draft, step })); } catch { /* storage unavailable */ }
  }, [draft, step]);

  if (!isAuthenticated) {
    return (
      <Desk>
        <p className="dc-small">This desk is private.</p>
        <button className="dc-btn on-desk" onClick={navigateToLogin}>Sign in</button>
      </Desk>
    );
  }
  if (!isAdmin) {
    return <Desk><p className="dc-small">This desk belongs to Alex. <Link to="/" style={{ textDecoration: "underline" }}>Read today's page →</Link></p></Desk>;
  }

  const go = (n) => { setMsg(""); setStep(n); window.scrollTo(0, 0); };
  const reset = () => { setDraft(blank); setExtras({ endings: [], warnings: [], checks: [], redo: "" }); go(0); };

  // ---- Step 1: catch ----
  const saveSpark = async (andUse) => {
    const text = newSpark.text.trim();
    if (text.split(/\s+/).length < 3) return setMsg("Say what it was in a few words: what, where, how much.");
    setBusy(true);
    try {
      const s = await base44.entities.Spark.create({ text, kind: newSpark.kind, status: "new" });
      setNewSpark({ kind: newSpark.kind, text: "" });
      await qc.invalidateQueries({ queryKey: ["sparks"] });
      if (andUse) pickSpark(s);
      else setMsg("In the jar.");
    } catch (e) {
      setMsg(`Didn't save: ${e.message}`);
    } finally {
      setBusy(false);
    }
  };
  const pickSpark = (s) => {
    setDraft({ ...draft, spark_id: s?.id || "", spark: s?.text || "", kind: s?.kind || "" });
    go(1);
  };
  const binSpark = async (s) => {
    await base44.entities.Spark.update(s.id, { status: "binned" });
    qc.invalidateQueries({ queryKey: ["sparks"] });
  };

  // ---- Step 3: shape and draft ----
  const draftIt = async (redoNote = "") => {
    setDrafting(true);
    setMsg("");
    try {
      const r = await callFn("draft-page", { spark: draft.spark, reaction: draft.reaction, shape: draft.shape, redo_note: redoNote });
      setDraft((d) => ({ ...d, title: r.title || d.title, body: r.body || d.body, highlight: r.highlight || "" }));
      setExtras({ endings: r.endings || [], warnings: r.warnings || [], checks: r.checks || [], redo: "" });
      go(3);
    } catch (e) {
      setMsg(`The draft didn't come back: ${e?.response?.data?.error || e.message}`);
    } finally {
      setDrafting(false);
    }
  };
  const writeMyself = () => {
    setExtras({ endings: [], warnings: [], checks: [], redo: "" });
    if (!draft.body && draft.reaction) setDraft({ ...draft, body: draft.reaction });
    go(3);
  };
  const swapEnding = (line) => {
    const paras = paragraphs(draft.body);
    const last = paras[paras.length - 1] || "";
    paras[paras.length - 1] = line;
    setDraft({ ...draft, body: paras.join("\n\n"), highlight: draft.highlight === last ? line : draft.highlight });
  };

  // ---- Step 4: finish ----
  const emailOut = async (post) => {
    try {
      const r = await callFn("send-page", { post_id: post.id });
      if (r.not_configured) return " Not emailed yet: subscriber emails switch on once a sending domain is set up.";
      if (r.skipped) return ` ${r.skipped}`;
      if (r.errors?.length) return ` Emailed ${r.sent} of ${r.subscribers}; some failed.`;
      return r.subscribers ? ` Emailed to ${r.sent} ${r.sent === 1 ? "person" : "people"}.` : " No subscribers to email yet.";
    } catch (e) {
      return ` The email didn't go: ${e?.response?.data?.error || e.message}`;
    }
  };

  const save = async (status) => {
    if (!draft.title.trim() || !draft.body.trim()) return setMsg("Needs a title and at least one line.");
    if (/\[[^\]]+\]/.test(draft.body)) return setMsg("Fill in the [square brackets] first. They're details only you know.");
    if (draft.highlight.trim() && !draft.body.includes(draft.highlight.trim())) return setMsg("The highlighted line has changed. Tap it again below the page.");
    if (draft.note_image && !draft.highlight.trim()) return setMsg("A margin note sits under the highlighted line, so pick a highlight too.");
    setBusy(true);
    setMsg("");
    const fields = {
      title: draft.title.trim(),
      body: draft.body.trim(),
      highlight: draft.highlight.trim(),
      note: draft.note.trim(),
      note_image: draft.note_image || "",
      note_width: draft.note_width || null,
      spark_id: draft.spark_id || "",
      spark: draft.spark || "",
      reaction: draft.reaction || "",
      shape: draft.shape || "page",
      status,
    };
    if (status === "published") fields.published_on = todayIso();
    try {
      const number = draft.id ? all.find((p) => p.id === draft.id)?.number || nextNumber : nextNumber;
      const saved = draft.id
        ? await base44.entities.Post.update(draft.id, fields)
        : await base44.entities.Post.create({ ...fields, number });
      if (draft.spark_id && status === "published") await base44.entities.Spark.update(draft.spark_id, { status: "used", used_in: number }).catch(() => {});
      let note = status === "published" ? `No. ${pad(number)} is up. That's today done.` : "Saved as a draft.";
      if (status === "published") note += await emailOut({ id: saved?.id || draft.id });
      await qc.invalidateQueries({ queryKey: ["posts"] });
      await qc.invalidateQueries({ queryKey: ["sparks"] });
      try { localStorage.removeItem("dc-desk"); } catch { /* storage unavailable */ }
      setDraft(blank);
      setExtras({ endings: [], warnings: [], checks: [], redo: "" });
      setStep(0);
      setMsg(note);
      window.scrollTo(0, 0);
    } catch (e) {
      setMsg(`Didn't save: ${e.message || "unknown error"}`);
    } finally {
      setBusy(false);
    }
  };

  const testEmail = async () => {
    const latest = published[0];
    if (!latest) return setMsg("Publish a page first.");
    setBusy(true);
    try {
      const r = await callFn("send-page", { post_id: latest.id, test: true });
      setMsg(`Sent No. ${pad(latest.number)} to ${r.to} as a test.`);
    } catch (e) {
      setMsg(`Test didn't send: ${e?.response?.data?.error || e.message}`);
    } finally {
      setBusy(false);
    }
  };

  const keepSignature = async ({ url }) => {
    const [row] = await base44.entities.Setting.filter({ key: "signature" });
    if (row) await base44.entities.Setting.update(row.id, { value: url });
    else await base44.entities.Setting.create({ key: "signature", value: url });
    await qc.invalidateQueries({ queryKey: ["setting", "signature"] });
    setMsg("Signature saved. It's on every page now.");
  };

  const openDraft = (p) => {
    setDraft({ ...blank, ...Object.fromEntries(Object.keys(blank).map((k) => [k, p[k] ?? blank[k]])), id: p.id });
    setExtras({ endings: [], warnings: [], checks: [], redo: "" });
    go(3);
  };

  return (
    <Desk>
      <nav className="dc-steps" aria-label="Today's page">
        {STEPS.map((s, i) => (
          <button
            key={s}
            type="button"
            className={`dc-step ${i === step ? "on" : ""} ${i < step ? "done" : ""}`}
            aria-current={i === step ? "step" : undefined}
            disabled={i > step}
            onClick={() => go(i)}
          >
            <span className="n">{i + 1}</span> {s}
          </button>
        ))}
      </nav>
      <p className="dc-small dc-steps-note">
        {publishedToday
          ? "Today's page is up. Anything you catch now goes in the jar for tomorrow."
          : `No. ${pad(nextNumber)} · ${longDate(todayIso())} · about 10 minutes`}
      </p>
      {msg && <p className="dc-small dc-msg" role="status">{msg}</p>}

      {step === 0 && (
        <>
          <form className="dc-card dc-card-flat dc-spark-form" onSubmit={(e) => { e.preventDefault(); saveSpark(false); }}>
            <p className="dc-label" style={{ margin: "0 0 0.6rem" }}>Catch something</p>
            <div className="dc-chips" role="radiogroup" aria-label="What kind">
              {KINDS.map(([k, label]) => (
                <button key={k} type="button" role="radio" aria-checked={newSpark.kind === k} className={`dc-chip ${newSpark.kind === k ? "on" : ""}`} onClick={() => setNewSpark({ ...newSpark, kind: k })}>
                  {label}
                </button>
              ))}
            </div>
            <label htmlFor="w-spark" className="dc-small" style={{ display: "block", margin: "0.8rem 0 0.3rem" }}>
              What was it, exactly? Where, how much, what it was like.
            </label>
            <textarea
              id="w-spark"
              className="dc-field dc-spark-text"
              rows={3}
              placeholder="A £3.80 flat white from the place by the station. Lid didn't fit. Drank half."
              value={newSpark.text}
              onChange={(e) => setNewSpark({ ...newSpark, text: e.target.value })}
            />
            <div className="dc-row">
              <button type="button" className="dc-btn" disabled={busy} onClick={() => saveSpark(true)}>Write about this now →</button>
              <button type="submit" className="dc-btn" disabled={busy}>Save for later</button>
            </div>
          </form>

          <section className="dc-section">
            <h2 className="dc-label">The jar · {sparks.length} waiting</h2>
            {sparks.length === 0 ? (
              <p className="dc-small" style={{ color: "var(--desk-faint)" }}>
                Empty. Add things here during the day, from your phone, as they happen. Thirty seconds each.
              </p>
            ) : (
              <ul className="dc-ledger dc-jar">
                {sparks.map((s) => (
                  <li key={s.id}>
                    <div className="dc-jar-row">
                      <span className="n">{(KINDS.find(([k]) => k === s.kind) || ["", ""])[1]}</span>
                      <span className="t">{s.text}</span>
                      <span className="dc-jar-actions">
                        <button type="button" className="dc-btn" onClick={() => pickSpark(s)}>Use</button>
                        <button type="button" className="dc-link-btn" onClick={() => binSpark(s)}>bin</button>
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <button type="button" className="dc-link-btn on-desk" style={{ marginTop: "1rem" }} onClick={() => pickSpark(null)}>
              Nothing caught today? Start from a thought instead →
            </button>
          </section>
        </>
      )}

      {step === 1 && (
        <div className="dc-card dc-card-flat">
          {draft.spark ? (
            <p className="dc-small dc-spark-quote"><span className="dc-label">The spark</span><br />{draft.spark}</p>
          ) : (
            <p className="dc-small dc-spark-quote"><span className="dc-label">No spark</span><br />Start from a thought. Make it concrete: one object, one moment.</p>
          )}
          <label htmlFor="w-reaction" className="dc-label" style={{ display: "block", margin: "1.2rem 0 0.4rem" }}>What did you notice?</label>
          <p className="dc-small" style={{ margin: "0 0 0.6rem", color: "var(--ink-soft)" }}>
            One or two lines, in your own words. This is the page; the rest is shaping. If you're stuck, answer one of these:
          </p>
          <ul className="dc-prompts">
            {REACT_PROMPTS.map((q) => <li key={q}>{q}</li>)}
          </ul>
          <textarea
            id="w-reaction"
            className="dc-field dc-spark-text"
            rows={4}
            placeholder="I paid for the second half and threw it away. Nobody budgets for the bit they don't finish."
            value={draft.reaction}
            onChange={set("reaction")}
          />
          <div className="dc-row">
            <button type="button" className="dc-btn" onClick={() => go(0)}>← Back</button>
            <button
              type="button"
              className="dc-btn"
              onClick={() => (draft.reaction.trim().split(/\s+/).length < 4 ? setMsg("A line or two first. Even a rough one.") : go(2))}
            >
              Next: pick a shape →
            </button>
          </div>
        </div>
      )}

      {step === 2 && (
        <>
          <div className="dc-shapes" role="radiogroup" aria-label="Shape">
            {Object.entries(SHAPES).map(([k, s]) => (
              <button
                key={k}
                type="button"
                role="radio"
                aria-checked={draft.shape === k}
                className={`dc-shape ${draft.shape === k ? "on" : ""}`}
                onClick={() => setDraft({ ...draft, shape: k })}
              >
                <span className="dc-label">{s.name}</span>
                <span className="dc-small size">{s.size}</span>
                <span className="dc-small">{s.recipe}</span>
                <span className="dc-small ex">Like {s.example}</span>
              </button>
            ))}
          </div>
          <div className="dc-row" style={{ marginTop: "1.5rem" }}>
            <button type="button" className="dc-btn on-desk" onClick={() => go(1)}>← Back</button>
            <button type="button" className="dc-btn on-desk" disabled={drafting} onClick={() => draftIt()}>
              {drafting ? "Drafting… about a minute" : "Draft it for me →"}
            </button>
            <button type="button" className="dc-btn on-desk" disabled={drafting} onClick={writeMyself}>I'll write it myself</button>
          </div>
          <p className="dc-small" style={{ color: "var(--desk-faint)", marginTop: "0.8rem" }}>
            The draft only uses what you've written. Anything it needs and doesn't know comes back in [square brackets] for you to fill.
          </p>
        </>
      )}

      {step === 3 && (
        <>
          <Paper marks={sheetMarks(draft.id ? 2 : nextNumber)}>
            <div className="dc-meta">
              <span className="dc-no">{draft.id ? "Draft" : `No. ${pad(nextNumber)}`}</span>
              <span>{SHAPES[draft.shape]?.name || "Page"} · {words} words</span>
            </div>

            <label htmlFor="w-title" className="sr-only">Title</label>
            <input id="w-title" className="dc-field title" placeholder="Title" value={draft.title} onChange={set("title")} />

            <label htmlFor="w-body" className="sr-only">The page</label>
            <textarea id="w-body" className="dc-field body" placeholder={SHAPES[draft.shape]?.recipe} value={draft.body} onChange={set("body")} />

            <div className="dc-hand">
              <p className="dc-small" style={{ margin: "0 0 0.5rem", color: "var(--ink-soft)" }}>The line to highlight: tap one.</p>
              <div className="dc-sentences">
                {sentences.map((s, i) => (
                  <button key={i} type="button" className={`dc-sentence ${draft.highlight === s ? "on" : ""}`} onClick={() => setDraft({ ...draft, highlight: draft.highlight === s ? "" : s })}>
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <HandUpload
              id="w-note-photo"
              name="note"
              label="Margin note (optional)"
              hint="Write two to five words in red pen on plain paper. Photograph it straight on, in daylight. It goes under the highlighted line."
              current={draft.note_image}
              previewWidth={(px) => noteSize(px || draft.note_width)}
              onKeep={({ url, width }) => setDraft({ ...draft, note_image: url, note_width: width })}
            />
            {draft.note_image && (
              <>
                <label htmlFor="w-note" className="dc-small" style={{ display: "block", marginTop: "0.6rem", color: "var(--ink-soft)" }}>
                  What the note says (for screen readers)
                </label>
                <input id="w-note" className="dc-field" style={{ borderBottom: "1px dashed var(--ink-soft)", padding: "0.3rem 0" }} value={draft.note} onChange={set("note")} />
                <button type="button" className="dc-btn" style={{ marginTop: "0.8rem" }} onClick={() => setDraft({ ...draft, note_image: "", note_width: null, note: "" })}>
                  Remove note
                </button>
              </>
            )}
          </Paper>

          {(extras.warnings.length > 0 || extras.endings.length > 0) && (
            <div className="dc-card dc-card-flat" style={{ marginTop: "1.5rem" }}>
              {extras.warnings.length > 0 && (
                <>
                  <p className="dc-label" style={{ margin: "0 0 0.4rem" }}>Before you publish</p>
                  <ul className="dc-prompts">{extras.warnings.map((w) => <li key={w}>{w}</li>)}</ul>
                </>
              )}
              {extras.endings.length > 0 && (
                <>
                  <p className="dc-label" style={{ margin: "1rem 0 0.4rem" }}>Other last lines: tap to swap</p>
                  <div className="dc-sentences">
                    {extras.endings.map((l) => <button key={l} type="button" className="dc-sentence" onClick={() => swapEnding(l)}>{l}</button>)}
                  </div>
                </>
              )}
              {draft.reaction && (
                <div className="dc-redo">
                  <label htmlFor="w-redo" className="dc-small" style={{ color: "var(--ink-soft)" }}>Not right? Say what to change and redraft:</label>
                  <div className="dc-row" style={{ marginTop: "0.4rem" }}>
                    <input id="w-redo" className="dc-input" placeholder="shorter; open on the lid" value={extras.redo} onChange={(e) => setExtras({ ...extras, redo: e.target.value })} />
                    <button type="button" className="dc-btn" disabled={drafting} onClick={() => draftIt(extras.redo)}>{drafting ? "Drafting…" : "Redraft"}</button>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="dc-row" style={{ marginTop: "1.5rem" }}>
            <button className="dc-btn on-desk" disabled={busy} onClick={() => save("published")}>Publish today</button>
            <button className="dc-btn on-desk" disabled={busy} onClick={() => save("draft")}>Save draft</button>
            <button className="dc-btn on-desk" disabled={busy} onClick={() => go(2)}>← Shape</button>
            <button className="dc-link-btn on-desk" onClick={reset}>Start over</button>
          </div>
          <p className="dc-small" style={{ color: "var(--desk-faint)", marginTop: "0.8rem" }}>
            Publishing emails the page to {subCount ?? "…"} {subCount === 1 ? "subscriber" : "subscribers"}.{" "}
            <button type="button" className="dc-link-btn on-desk" onClick={testEmail} disabled={busy}>Send me a test of the last page</button>
          </p>
        </>
      )}

      {drafts.length > 0 && (
        <section className="dc-section">
          <h2 className="dc-label">Drafts (only you see these)</h2>
          <ul className="dc-ledger">
            {drafts.map((p) => (
              <li key={p.id}>
                <a href="#" onClick={(e) => { e.preventDefault(); openDraft(p); }}>
                  <span className="n">{pad(p.number)}</span>
                  <span className="t">{p.title}</span>
                  <span className="d">draft</span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      <details className="dc-section dc-details">
        <summary className="dc-label">Your signature{signature === DEFAULT_SIGNATURE ? " · still the stand-in" : ""}</summary>
        <div className="dc-card dc-card-flat" style={{ marginTop: "0.9rem" }}>
          <HandUpload
            id="w-sig-photo"
            name="signature"
            label={signature === DEFAULT_SIGNATURE ? "The one on the pages is a stand-in. Sign plain white paper in blue biro and photograph it." : "Signed in your own hand. Retake it any time."}
            lineHeight={290}
            current={signature}
            taken={signature !== DEFAULT_SIGNATURE}
            previewWidth={() => "9.5rem"}
            onKeep={keepSignature}
          />
        </div>
      </details>

      <h2 className="dc-label" style={{ color: "var(--desk-faint)", margin: "4rem 0 0.9rem" }}>Published</h2>
      <Ledger posts={published.slice(0, 10)} />
    </Desk>
  );
}
