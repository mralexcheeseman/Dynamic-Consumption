import Desk, { useDocTitle } from "@/components/Sheet";
import Ledger from "@/components/Ledger";
import { usePublished } from "@/components/posts";

export default function Archive() {
  useDocTitle("Archive");
  const { data: posts = [], isLoading } = usePublished();

  return (
    <Desk>
      <section className="dc-section" style={{ marginTop: 0 }}>
        <h1 className="dc-label">{isLoading ? "Counting…" : `Every page so far · ${posts.length}`}</h1>
        <Ledger posts={posts} />
      </section>
    </Desk>
  );
}
