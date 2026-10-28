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

// Alex's signature: his own scan once he's uploaded one on /write, the generated one until then.
export const DEFAULT_SIGNATURE = "/assets/signature.webp";

export function useSignature() {
  const { data } = useQuery({
    queryKey: ["setting", "signature"],
    queryFn: async () => {
      const [row] = await base44.entities.Setting.filter({ key: "signature" });
      return row || null;
    },
    staleTime: 5 * 60 * 1000,
  });
  return data?.value || DEFAULT_SIGNATURE;
}
