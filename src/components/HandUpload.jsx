import { useRef, useState } from "react";
import { base44 } from "@/api/base44Client";
import { liftInk, toFile } from "@/lib/ink";

// Photograph something written on paper; the ink is lifted off, previewed on the
// page's own paper, and uploaded only when you keep it.
// onKeep({ url, width }) gets the stored file's URL and its width in pixels.
export default function HandUpload({ id, label, hint, lineHeight = 110, name = "hand", previewWidth, onKeep, current }) {
  const input = useRef(null);
  const [lifted, setLifted] = useState(null);
  const [state, setState] = useState("idle"); // idle | lifting | ready | saving | error
  const [error, setError] = useState("");

  const pick = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setState("lifting");
    setError("");
    try {
      const out = await liftInk(file, { lineHeight });
      setLifted(out);
      setState("ready");
    } catch (err) {
      setError(err.message || "Couldn't read that photo.");
      setState("error");
    }
  };

  const keep = async () => {
    if (!lifted) return;
    setState("saving");
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file: toFile(lifted.blob, `${name}-${Date.now()}`) });
      onKeep({ url: file_url, width: lifted.width });
      URL.revokeObjectURL(lifted.url);
      setLifted(null);
      setState("idle");
    } catch (err) {
      setError(`Upload failed: ${err.message || "unknown error"}`);
      setState("error");
    }
  };

  const shown = lifted?.url || current;
  const width = previewWidth ? previewWidth(lifted?.width) : undefined;

  return (
    <div className="dc-hand">
      <div className="dc-hand-head">
        <label htmlFor={id} className="dc-small">{label}</label>
        <input id={id} ref={input} type="file" accept="image/*" capture="environment" onChange={pick} className="sr-only" />
        <button type="button" className="dc-btn" onClick={() => input.current?.click()} disabled={state === "lifting" || state === "saving"}>
          {state === "lifting" ? "Lifting ink…" : shown ? "Retake" : "Photograph it"}
        </button>
      </div>
      {hint && !shown && <p className="dc-small dc-hint">{hint}</p>}
      {shown && (
        <div className="dc-hand-preview">
          <img src={shown} alt="" style={width ? { width } : undefined} />
        </div>
      )}
      {state === "ready" && (
        <div className="dc-hand-actions">
          <button type="button" className="dc-btn" onClick={keep}>Keep this</button>
          <button type="button" className="dc-btn" onClick={() => { URL.revokeObjectURL(lifted.url); setLifted(null); setState("idle"); }}>Discard</button>
        </div>
      )}
      {state === "saving" && <p className="dc-small">Saving…</p>}
      {error && <p className="dc-small dc-err">{error}</p>}
    </div>
  );
}
