import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import Desk, { Paper, useDocTitle, pad, todayIso, longDate } from "@/components/Sheet";
import { sheetMarks } from "@/components/marks";
import { useSignature, DEFAULT_SIGNATURE } from "@/components/posts";
import Ledger from "@/components/Ledger";
import HandUpload from "@/components/HandUpload";

const blank = { id: null, title: "", body: "", highlight: "", note: "", note_image: "", note_width: null };

// Margin notes are drawn at 0.025rem per pixel, the same rule as on the page.
const noteSize = (px) => (px ? `${(px * 0.025).toFixed(2)}rem` : undefined);

const callFn = async (name, data) => {
  const res = await base44.functions.invoke(name, data);
  return res?.data ?? res ?? {};
};

export default function Write() {
  useDocTitle("Write");
  const { user, isAuthenticated, navigateToLogin } = useAuth();
  const qc = useQueryClient();
  const signature = useSignature();
  const [draft, setDraft] = useState(blank);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const isAdmin = user?.role === "admin";

  const { data: all = [] } = useQuery({
    queryKey: ["posts", "all"],
    queryFn: () => base44.entities.Post.list("-number", 1000),
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
  const set = (k) => (e) => setDraft({ ...draft, [k]: e.target.value });

  // Keep an unsent page in this browser in case the tab closes.
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("dc-unsent") || "null");
      if (saved?.body || saved?.title) setDraft({ ...blank, ...saved, id: null });
    } catch { /* storage unavailable */ }
  }, []);
  useEffect(() => {
    if (draft.id) return;
    try { localStorage.setItem("dc-unsent", JSON.stringify({ ...draft, id: null })); } catch { /* storage unavailable */ }
  }, [draft]);

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

  const emailOut = async (post) => {
    try {
      const r = await callFn("send-page", { post_id: post.id });
      if (r.not_configured) return " Not emailed: emails are off until a sending domain is set up.";
      if (r.skipped) return ` ${r.skipped}`;
      if (r.errors?.length) return ` Emailed ${r.sent} of ${r.subscribers}; some failed.`;
      return r.subscribers ? ` Emailed to ${r.sent} ${r.sent === 1 ? "person" : "people"}.` : " No subscribers to email yet.";
    } catch (e) {
      return ` The email didn't go: ${e?.response?.data?.error || e.message}`;
    }
  };

  const save = async (status) => {
    if (!draft.title.trim() || !draft.body.trim()) {
      setMsg("Needs a title and at least one line.");
      return;
    }
    if (draft.highlight.trim() && !draft.body.includes(draft.highlight.trim())) {
      setMsg("The highlight has to be copied exactly from the text.");
      return;
    }
    if (draft.note_image && !draft.highlight.trim()) {
      setMsg("A margin note sits under the highlighted line, so pick a highlight too.");
      return;
    }
    setBusy(true);
    setMsg("");
    const fields = {
      title: draft.title.trim(),
      body: draft.body.trim(),
      highlight: draft.highlight.trim(),
      note: draft.note.trim(),
      note_image: draft.note_image || "",
      note_width: draft.note_width || null,
      status,
    };
    if (status === "published") fields.published_on = todayIso();
    try {
      const saved = draft.id
        ? await base44.entities.Post.update(draft.id, fields)
        : await base44.entities.Post.create({ ...fields, number: nextNumber });
      try { localStorage.removeItem("dc-unsent"); } catch { /* storage unavailable */ }
      let note = status === "published" ? "Published. That's today done." : "Saved as a draft.";
      if (status === "published") note += await emailOut({ ...fields, id: saved?.id || draft.id });
      await qc.invalidateQueries({ queryKey: ["posts"] });
      setMsg(note);
      setDraft(blank);
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

  return (
    <Desk>
      <Paper marks={sheetMarks(draft.id ? 2 : nextNumber)}>
        <div className="dc-meta">
          <span className="dc-no">{draft.id ? "Draft" : `No. ${pad(nextNumber)}`}</span>
          <span>{longDate(todayIso())} · {words} words</span>
        </div>

        <label htmlFor="w-title" className="sr-only">Title</label>
        <input id="w-title" className="dc-field title" placeholder="Title" value={draft.title} onChange={set("title")} />

        <label htmlFor="w-body" className="sr-only">The page</label>
        <textarea id="w-body" className="dc-field body" placeholder="Say the thing in the first line. Blank line between paragraphs." value={draft.body} onChange={set("body")} />

        <label htmlFor="w-hl" className="dc-small" style={{ display: "block", marginTop: "1rem", color: "var(--ink-soft)" }}>
          Highlight (paste one line from the page)
        </label>
        <input id="w-hl" className="dc-field" style={{ borderBottom: "1px dashed var(--ink-soft)", padding: "0.3rem 0" }} value={draft.highlight} onChange={set("highlight")} />

        <HandUpload
          id="w-note-photo"
          name="note"
          label="Margin note (optional)"
          hint="Write a few words on plain paper with a red pen, take a photo straight on, in daylight. It goes under the highlighted line."
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

      <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", flexWrap: "wrap", marginTop: "1.5rem" }}>
        <button className="dc-btn on-desk" disabled={busy} onClick={() => save("published")}>Publish today</button>
        <button className="dc-btn on-desk" disabled={busy} onClick={() => save("draft")}>Save draft</button>
        {draft.id && <button className="dc-btn on-desk" disabled={busy} onClick={() => setDraft(blank)}>New page</button>}
        {msg && <span className="dc-small" role="status">{msg}</span>}
      </div>
      <p className="dc-small" style={{ color: "var(--desk-faint)", marginTop: "0.8rem" }}>
        Publishing emails the page to {subCount ?? "…"} {subCount === 1 ? "subscriber" : "subscribers"}.{" "}
        <button type="button" onClick={testEmail} disabled={busy} style={{ background: "none", border: 0, padding: 0, color: "var(--desk-ink)", textDecoration: "underline", cursor: "pointer", font: "inherit" }}>
          Send me a test
        </button>
      </p>

      {drafts.length > 0 && (
        <section className="dc-section">
          <h2 className="dc-label">Drafts (only you see these)</h2>
          <ul className="dc-ledger">
            {drafts.map((p) => (
              <li key={p.id}>
                <a href="#" onClick={(e) => { e.preventDefault(); setDraft({ ...blank, id: p.id, title: p.title, body: p.body, highlight: p.highlight || "", note: p.note || "", note_image: p.note_image || "", note_width: p.note_width || null }); window.scrollTo(0, 0); }}>
                  <span className="n">{pad(p.number)}</span>
                  <span className="t">{p.title}</span>
                  <span className="d">draft</span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="dc-section">
        <h2 className="dc-label">Your signature</h2>
        <div className="dc-card dc-card-flat">
          <HandUpload
            id="w-sig-photo"
            name="signature"
            label={signature === DEFAULT_SIGNATURE ? "The one on the pages is a stand-in. Sign plain white paper in blue biro and photograph it." : "Signed in your own hand. Retake it any time."}
            lineHeight={290}
            current={signature}
            previewWidth={() => "9.5rem"}
            onKeep={keepSignature}
          />
        </div>
      </section>

      <h2 className="dc-label" style={{ color: "var(--desk-faint)", margin: "4rem 0 0.9rem" }}>Published</h2>
      <Ledger posts={published.slice(0, 10)} />
    </Desk>
  );
}
