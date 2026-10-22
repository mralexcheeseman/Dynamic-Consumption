import { Link, useParams } from "react-router-dom";
import Desk, { useDocTitle } from "@/components/Sheet";
import PostView from "@/components/PostView";
import { usePublished } from "@/components/posts";

export default function Post() {
  const { number } = useParams();
  const { data: posts = [], isLoading } = usePublished();
  const i = posts.findIndex((p) => String(p.number) === number);
  const post = posts[i];
  useDocTitle(post?.title);

  if (isLoading) return <Desk><p className="dc-small">Turning pages…</p></Desk>;
  if (!post) {
    return (
      <Desk>
        <p className="dc-small">
          There's no page {number}. Not yet, anyway. <Link to="/" style={{ textDecoration: "underline" }}>Today's page →</Link>
        </p>
      </Desk>
    );
  }

  // Posts are sorted newest first, so "next" is the one before it in the list.
  return (
    <Desk>
      <PostView post={post} prev={posts[i + 1]} next={posts[i - 1]} />
    </Desk>
  );
}
