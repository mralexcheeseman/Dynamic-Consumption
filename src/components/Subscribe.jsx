import { useState } from "react";
import { base44 } from "@/api/base44Client";

// An index card left on the desk: write your address on it.
export default function Subscribe() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState("idle"); // idle | sending | done | error

  const submit = async (e) => {
    e.preventDefault();
    if (!email.includes("@")) return;
    setState("sending");
    try {
      await base44.functions.invoke("subscribe", { email: email.trim() });
      setState("done");
    } catch {
      setState("error");
    }
  };

  return (
    <form className="dc-card" onSubmit={submit}>
      {state === "done" ? (
        <p className="dc-small" style={{ margin: 0, lineHeight: "1.7rem" }}>
          Got it. Tomorrow's page will find you.
        </p>
      ) : (
        <>
          <label htmlFor="dc-email">Want the page in your inbox? One a day. Leave whenever.</label>
          <div className="dc-card-row">
            <input
              id="dc-email"
              type="email"
              required
              autoComplete="email"
              placeholder="your email"
              className="dc-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <button className="dc-btn" disabled={state === "sending"}>
              {state === "sending" ? "..." : "Send it"}
            </button>
          </div>
          {state === "error" && (
            <p className="dc-small dc-err" style={{ margin: "0.6rem 0 0" }}>
              That didn't go through. Check the address and try again.
            </p>
          )}
        </>
      )}
    </form>
  );
}
