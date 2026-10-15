import { Badge } from "@/components/ui";

const TONE = { high: ["red", "উচ্চ ঝুঁকি · Hold"], medium: ["amber", "মনোযোগ · Attention"], unknown: ["purple", "অনিশ্চিত · Unknown"], info: ["blue", "তথ্য · Info"] };

export default function Indicators({ items, title = "সতর্কতা ও ঝুঁকি-সূচক" }) {
  if (!items?.length) return null;
  return (
    <section aria-label={title} className="space-y-2">
      <h3 className="text-sm font-semibold text-slate-800">{title} <span className="font-normal text-slate-500">Warnings &amp; risk indicators</span></h3>
      <ul className="space-y-2">
        {items.map((i, n) => (
          <li key={`${i.code}-${n}`} className="rounded-md border border-slate-200 bg-white p-3 text-sm">
            <div className="flex flex-wrap items-center gap-2"><Badge tone={TONE[i.level][0]}>{TONE[i.level][1]}</Badge><span className="font-semibold">{i.bn}</span></div>
            <p className="mt-1 text-slate-700">{i.en}</p>
            {i.detail && <p className="text-slate-600">{i.detail}</p>}
            <p className="mt-1 text-xs text-slate-500">উৎস · Source: {i.source} · <span className="font-mono">{i.code}</span></p>
          </li>
        ))}
      </ul>
      <p className="text-xs text-slate-500">সূচকগুলো পর্যালোচনায় সাহায্যের জন্য; এগুলো কোনো আবেদন অনুমোদন বা বাতিল করে না। Indicators support review; they do not approve or reject anything.</p>
    </section>
  );
}
