import { Link } from "react-router-dom";
import Desk, { useDocTitle } from "@/components/Sheet";
import PostView from "@/components/PostView";
import Ledger from "@/components/Ledger";
import { usePublished } from "@/components/posts";

export default function Home() {
  useDocTitle();
  const { data: posts = [], isLoading } = usePublished();
  const [latest, ...earlier] = posts;

  if (isLoading) return <Desk><p className="dc-small">Finding today's page…</p></Desk>;
  if (!latest) return <Desk><p className="dc-small">Nothing on the desk yet. Check back tomorrow.</p></Desk>;

  return (
    <Desk>
      <PostView post={latest} prev={earlier[0]} />

      {earlier.length > 0 && (
        <section className="dc-section">
          <h2 className="dc-label">Earlier pages</h2>
          <Ledger posts={earlier.slice(0, 7)} />
          <Link to="/archive" className="dc-more dc-label">All {posts.length} pages →</Link>
        </section>
      )}
    </Desk>
  );
}
