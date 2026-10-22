import Desk, { useDocTitle } from "@/components/Sheet";
import Ledger from "@/components/Ledger";
import { usePublished } from "@/components/posts";

export default function Archive() {
  useDocTitle("Archive");
  const { data: posts = [], isLoading } = usePublished();

  return (
    <Desk>
      <h1 className="dc-section-label" style={{ marginTop: 0, fontSize: "2.4rem" }}>every page so far</h1>
      <p className="dc-small" style={{ color: "var(--desk-faint)", margin: "0 0 1.5rem" }}>
        {isLoading ? "Counting…" : `${posts.length} of them. Newest on top.`}
      </p>
      <Ledger posts={posts} />
    </Desk>
  );
}
