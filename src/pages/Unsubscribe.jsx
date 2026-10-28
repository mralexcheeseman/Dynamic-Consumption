import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import Desk, { useDocTitle } from "@/components/Sheet";

// The link at the bottom of every email. One click, no login, no "are you sure".
export default function Unsubscribe() {
  useDocTitle("Unsubscribe");
  const [params] = useSearchParams();
  const t = params.get("t") || "";
  const [state, setState] = useState(t ? "working" : "missing");

  useEffect(() => {
    if (!t) return;
    base44.functions
      .invoke("unsubscribe", { t })
      .then(() => setState("done"))
      .catch(() => setState("error"));
  }, [t]);

  return (
    <Desk>
      <form className="dc-card" onSubmit={(e) => e.preventDefault()}>
        <p className="dc-small" style={{ margin: 0, lineHeight: "1.7rem" }}>
          {state === "working" && "Taking you off the list…"}
          {state === "done" && "Done. No more pages in your inbox. They'll still be here on the desk."}
          {state === "missing" && "This link is missing its code. Use the link at the bottom of any email."}
          {state === "error" && "That didn't work. Try the link again in a minute."}
        </p>
      </form>
      <p className="dc-label" style={{ textAlign: "center", marginTop: "2rem" }}>
        <Link to="/" style={{ color: "var(--desk-ink)" }}>Today's page →</Link>
      </p>
    </Desk>
  );
}
