import Link from "next/link";
import { StatusPill } from "@/components/ui";

export default function ToolTile({ href, title, en, text, status = "functional" }) {
  const body = (
    <div className={`h-full rounded-lg border bg-white p-4 shadow-sm ${href ? "border-slate-200 hover:border-brand-600 hover:shadow" : "border-dashed border-slate-300 opacity-80"}`}>
      <div className="mb-2 flex items-start justify-between gap-2"><h3 className="font-semibold">{title}<span className="block text-xs font-normal text-slate-500">{en}</span></h3><StatusPill kind={status} /></div>
      <p className="text-sm text-slate-600">{text}</p>
    </div>
  );
  return href ? <Link href={href} className="block h-full">{body}</Link> : <div aria-disabled="true">{body}</div>;
}
