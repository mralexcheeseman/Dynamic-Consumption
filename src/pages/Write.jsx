import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import Desk, { Paper, useDocTitle, pad, todayIso, longDate } from "@/components/Sheet";
import { sheetMarks } from "@/components/marks";
import Ledger from "@/components/Ledger";

const blank = { id: null, title: "", body: "", highlight: "" };

export default function Write() {
  useDocTitle("Write");
  const { user, isAuthenticated, navigateToLogin } = useAuth();
  const qc = useQueryClient();
  const [draft, setDraft] = useState(blank);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const isAdmin = user?.role === "admin";

  const { data: all = [] } = useQuery({
    queryKey: ["posts", "all"],
    queryFn: () => base44.entities.Post.list("-number", 1000),
    enabled: isAdmin,
  });
  const drafts = all.filter((p) => p.status === "draft");
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

  const save = async (status) => {
    if (!draft.title.trim() || !draft.body.trim()) {
      setMsg("Needs a title and at least one line.");
      return;
    }
    if (draft.highlight.trim() && !draft.body.includes(draft.highlight.trim())) {
      setMsg("The highlight has to be copied exactly from the text.");
      return;
    }
    setBusy(true);
    setMsg("");
    const fields = {
      title: draft.title.trim(),
      body: draft.body.trim(),
      highlight: draft.highlight.trim(),
      status,
    };
    if (status === "published") fields.published_on = todayIso();
    try {
      if (draft.id) await base44.entities.Post.update(draft.id, fields);
      else await base44.entities.Post.create({ ...fields, number: nextNumber });
      try { localStorage.removeItem("dc-unsent"); } catch { /* storage unavailable */ }
      await qc.invalidateQueries({ queryKey: ["posts"] });
      setMsg(status === "published" ? "Published. That's today done." : "Saved as a draft.");
      setDraft(blank);
    } catch (e) {
      setMsg(`Didn't save: ${e.message || "unknown error"}`);
    } finally {
      setBusy(false);
    }
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

      </Paper>

      <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", flexWrap: "wrap", marginTop: "1.5rem" }}>
        <button className="dc-btn on-desk" disabled={busy} onClick={() => save("published")}>Publish today</button>
        <button className="dc-btn on-desk" disabled={busy} onClick={() => save("draft")}>Save draft</button>
        {draft.id && <button className="dc-btn on-desk" disabled={busy} onClick={() => setDraft(blank)}>New page</button>}
        {msg && <span className="dc-small" role="status">{msg}</span>}
      </div>

      {drafts.length > 0 && (
        <section className="dc-section">
          <h2 className="dc-label">Drafts (only you see these)</h2>
          <ul className="dc-ledger">
            {drafts.map((p) => (
              <li key={p.id}>
                <a href="#" onClick={(e) => { e.preventDefault(); setDraft({ id: p.id, title: p.title, body: p.body, highlight: p.highlight || "" }); window.scrollTo(0, 0); }}>
                  <span className="n">{pad(p.number)}</span>
                  <span className="t">{p.title}</span>
                  <span className="d">draft</span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      <h2 className="dc-label" style={{ color: "var(--desk-faint)", margin: "4rem 0 0.9rem" }}>Published</h2>
      <Ledger posts={all.filter((p) => p.status === "published").slice(0, 10)} />
    </Desk>
  );
}
