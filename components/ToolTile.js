import Link from "next/link";

export default function ToolTile({ href, title, en, text }) {
  return <Link href={href} className="group block h-full rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:border-brand-500 hover:shadow-lg">
    <div className="flex items-start justify-between gap-3"><div><h3 className="font-semibold text-slate-900">{title}</h3><span className="mt-1 block text-xs text-slate-500">{en}</span></div><span aria-hidden="true" className="text-xl text-brand-700 transition group-hover:translate-x-1">↗</span></div>
    <p className="mt-3 text-sm leading-6 text-slate-600">{text}</p>
  </Link>;
}
