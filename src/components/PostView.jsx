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
        <Coffee mark={m.coffee} />

        <div className="dc-meta">
          <span className="dc-stamp">
            No. {pad(post.number)}
            {m.circleStamp && <img className="ring" src="/assets/pen-circle.webp" alt="" />}
          </span>
          <span>{longDate(post.published_on)}</span>
        </div>

        <h1 className="dc-title">
          <Typed text={post.title} salt={post.number * 7} />
        </h1>

        <div className="dc-body">
          {paragraphs(post.body).map((p, i) => (
            <TypedPara key={i} text={p} highlight={post.highlight} salt={post.number * 100 + i * 11} variant={m.highlight} />
          ))}
        </div>

        <div className="dc-sign-row">
          <span className="dc-sign" aria-label="Signed, Alex">Alex</span>
          {post.note && (
            <span className="dc-note">
              <img src="/assets/pen-arrow.webp" alt="" />
              <span>{post.note}</span>
            </span>
          )}
        </div>
      </Paper>

      <nav className="dc-turn" aria-label="Other pages">
        <span>{prev && <Link to={`/p/${prev.number}`}>← No. {pad(prev.number)}</Link>}</span>
        <span>{next && <Link to={`/p/${next.number}`}>No. {pad(next.number)} →</Link>}</span>
      </nav>

      {withSubscribe && <Subscribe />}
    </>
  );
}
