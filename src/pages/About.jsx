import Desk, { Paper, useDocTitle } from "@/components/Sheet";
import { Typed, TypedPara, sheetMarks } from "@/components/marks";
import Subscribe from "@/components/Subscribe";

const lines = [
  "I'm Alex Cheeseman. I make brands and the things they sell.",
  "This is where I write one page a day. Short ones, mostly. Some about buying things, some about making things, some about neither.",
  "The name comes from a simple idea. Everybody consumes. The question is whether anything comes out the other side.",
  "Some pages will be bad. You don't get the good ones without showing up for the rest.",
];

export default function About() {
  useDocTitle("About");
  const m = { ...sheetMarks(5), sticker: false, receipt: "r", coffee: null };
  return (
    <Desk>
      <Paper marks={m}>
        <div className="dc-meta"><span className="dc-no">About</span></div>
        <h1 className="dc-title dc-ink"><Typed text="Who's typing" salt={3} /></h1>
        <div className="dc-body">
          {lines.map((p, i) => (
            <TypedPara key={i} text={p} salt={900 + i * 11} highlight="Everybody consumes." variant={1} />
          ))}
        </div>
        <div className="dc-sign-row">
          <img className="dc-sign" src="/assets/signature.webp" alt="Signed, Alex" />
          <img className="dc-note" src="/assets/note-about.webp" alt="Margin note: see you tomorrow" style={{ width: "13rem", transform: "rotate(-3deg)" }} />
        </div>
      </Paper>
      <Subscribe />
    </Desk>
  );
}
