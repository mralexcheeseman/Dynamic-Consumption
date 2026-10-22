import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";

export function usePublished() {
  return useQuery({
    queryKey: ["posts", "published"],
    queryFn: () => base44.entities.Post.filter({ status: "published" }, "-number", 1000),
  });
}

export function paragraphs(body = "") {
  return body.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
}
