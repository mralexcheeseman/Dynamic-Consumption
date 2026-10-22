import { Link } from "react-router-dom";
import { Paper, pad, longDate } from "@/components/Sheet";
import { Typed, TypedPara, sheetMarks, Coffee } from "@/components/marks";
import { paragraphs } from "@/components/posts";
import Subscribe from "@/components/Subscribe";

export default function PostView({ post, prev, next, withSubscribe = true }) {
  const m = sheetMarks(post.number);
  return (
    <>
      <Paper marks={m}>
        <div className="dc-sheet-clip"><Coffee mark={m.coffee} /></div>

        <div className="dc-meta">
          <span className="dc-no">
            No. {pad(post.number)}
            {m.ring && <img className="ring" src="/assets/pen-circle.webp" alt="" aria-hidden="true" />}
          </span>
          <span>{longDate(post.published_on)}</span>
        </div>

        <h1 className="dc-title dc-ink">
          <Typed text={post.title} salt={post.number * 7} />
        </h1>

        <div className="dc-body">
          {paragraphs(post.body).map((p, i) => (
            <TypedPara key={i} text={p} highlight={post.highlight} salt={post.number * 100 + i * 11} variant={m.highlight} />
          ))}
        </div>

        <div className="dc-sign-row">
          <img className="dc-sign" src="/assets/signature.webp" alt="Signed, Alex" />
          {post.note_image && (
            <img
              className="dc-note"
              src={post.note_image}
              alt={post.note ? `Margin note: ${post.note}` : ""}
              style={{ width: "13rem", transform: `rotate(${-2 - (post.number % 4)}deg)` }}
            />
          )}
        </div>
      </Paper>

      <nav className="dc-turn dc-label" aria-label="Other pages">
        <span>{prev && <Link to={`/p/${prev.number}`}>← No. {pad(prev.number)}</Link>}</span>
        <span>{next && <Link to={`/p/${next.number}`}>No. {pad(next.number)} →</Link>}</span>
      </nav>

      {withSubscribe && <Subscribe />}
    </>
  );
}
