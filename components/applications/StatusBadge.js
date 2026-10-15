import { Badge } from "@/components/ui";
import { statusMeta } from "@/lib/applications/status";

export default function StatusBadge({ status }) {
  const m = statusMeta(status);
  return <Badge tone={m.tone === "slate" ? "slate" : m.tone}>{m.bn} · {m.en}</Badge>;
}
