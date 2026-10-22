import Desk, { Paper, useDocTitle } from "@/components/Sheet";
import { Typed, TypedPara, sheetMarks } from "@/components/marks";
import Subscribe from "@/components/Subscribe";

const lines = [
  "I'm Alex Cheeseman. I make brands and the things they sell.",
  "This is where I write one page a day. Short ones, mostly. Some about buying things, some about making things, some about neither.",
  "The name comes from a simple idea. Everybody consumes. The question is whether anything comes out the other side.",
  "Not every page will be good. That's sort of the point. You don't get the good ones without showing up for the rest.",
];

export default function About() {
  useDocTitle("About");
  const m = sheetMarks(5);
  return (
    <Desk>
      <Paper marks={m}>
        <div className="dc-meta"><span className="dc-stamp">About</span></div>
        <h1 className="dc-title"><Typed text="Who's typing" salt={3} /></h1>
        <div className="dc-body">
          {lines.map((p, i) => (
            <TypedPara key={i} text={p} salt={900 + i * 11} highlight="Everybody consumes." variant={3} />
          ))}
        </div>
        <div className="dc-sign-row">
          <span className="dc-sign">Alex</span>
          <span className="dc-note"><img src="/assets/pen-arrow.webp" alt="" /><span>see you tomorrow</span></span>
        </div>
      </Paper>
      <Subscribe />
    </Desk>
  );
}
