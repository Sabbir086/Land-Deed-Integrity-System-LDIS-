import { cx } from "@/lib/utils";

export function Button({ variant = "primary", className, ...props }) {
  const styles = {
    primary: "bg-brand-700 text-white hover:bg-brand-800 disabled:bg-slate-400",
    secondary: "bg-white text-brand-800 border border-brand-600 hover:bg-brand-50 disabled:opacity-50",
    ghost: "text-slate-700 hover:bg-slate-100 disabled:opacity-50",
    danger: "bg-red-700 text-white hover:bg-red-800 disabled:bg-slate-400",
  };
  return <button className={cx("inline-flex min-h-[40px] items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed", styles[variant], className)} {...props} />;
}

export function Field({ label, hint, error, htmlFor, children }) {
  return (
    <div className="space-y-1">
      <label htmlFor={htmlFor} className="block text-sm font-medium text-slate-800">{label}</label>
      {children}
      {hint && !error && <p className="text-xs text-slate-500">{hint}</p>}
      {error && <p role="alert" className="text-xs font-medium text-red-700">{error}</p>}
    </div>
  );
}
const control = "block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm placeholder:text-slate-400 disabled:bg-slate-100 disabled:text-slate-500";
export const Input = ({ className, ...p }) => <input className={cx(control, className)} {...p} />;
export const Select = ({ className, children, ...p }) => <select className={cx(control, className)} {...p}>{children}</select>;

export function Card({ title, subtitle, actions, children, className }) {
  return (
    <section className={cx("rounded-lg border border-slate-200 bg-white shadow-sm", className)}>
      {(title || actions) && (
        <header className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-100 px-5 py-3">
          <div>
            {title && <h2 className="text-base font-semibold text-slate-900">{title}</h2>}
            {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
          </div>
          {actions}
        </header>
      )}
      <div className="p-5">{children}</div>
    </section>
  );
}

export function Alert({ tone = "info", title, children }) {
  const t = {
    info: "border-sky-300 bg-sky-50 text-sky-900",
    warn: "border-amber-300 bg-amber-50 text-amber-900",
    error: "border-red-300 bg-red-50 text-red-900",
    success: "border-emerald-300 bg-emerald-50 text-emerald-900",
  };
  return (
    <div role={tone === "error" ? "alert" : "status"} className={cx("rounded-md border px-4 py-3 text-sm", t[tone])}>
      {title && <p className="font-semibold">{title}</p>}
      <div className={title ? "mt-1" : ""}>{children}</div>
    </div>
  );
}

export function Badge({ tone = "slate", children }) {
  const t = {
    slate: "bg-slate-100 text-slate-700", green: "bg-emerald-100 text-emerald-800", amber: "bg-amber-100 text-amber-900",
    red: "bg-red-100 text-red-800", blue: "bg-sky-100 text-sky-800", purple: "bg-violet-100 text-violet-800",
  };
  return <span className={cx("inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold", t[tone])}>{children}</span>;
}

export function Spinner({ label = "লোড হচ্ছে…" }) {
  return (
    <span role="status" className="inline-flex items-center gap-2 text-sm text-slate-600">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-brand-600" aria-hidden="true" />
      {label}
    </span>
  );
}

export function DataTable({ columns, rows, empty = "কোনো তথ্য নেই", caption }) {
  return (
    <div className="overflow-x-auto rounded-md border border-slate-200">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead className="bg-slate-50">
          <tr>{columns.map((c) => <th key={c.key} scope="col" className="px-3 py-2 text-left font-semibold text-slate-700">{c.label}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white">
          {rows.length === 0 ? (
            <tr><td colSpan={columns.length} className="px-3 py-4 text-center text-slate-500">{empty}</td></tr>
          ) : rows.map((r, i) => (
            <tr key={r.id ?? i}>{columns.map((c) => <td key={c.key} className="px-3 py-2 align-top">{c.render ? c.render(r) : r[c.key] ?? "—"}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function PageHeader({ title, titleEn, description, actions }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{title}{titleEn && <span className="ml-2 text-base font-normal text-slate-500">{titleEn}</span>}</h1>
        {description && <p className="mt-1 max-w-3xl text-sm text-slate-600">{description}</p>}
      </div>
      {actions}
    </div>
  );
}

export function StatusPill({ kind }) {
  const m = { functional: ["green", "কার্যকর · Functional"], placeholder: ["amber", "প্লেসহোল্ডার · Placeholder"], blocked: ["red", "অপেক্ষমাণ · Blocked"] };
  const [tone, text] = m[kind];
  return <Badge tone={tone}>{text}</Badge>;
}

export const Disclaimer = () => (
  <Alert tone="warn" title="গুরুত্বপূর্ণ সতর্কতা · Important">
    এটি প্রকল্পের নিজস্ব রেফারেন্স ডেটাবেজের (পরীক্ষামূলক/কাল্পনিক তথ্য) ফলাফল। রেকর্ড মিলে যাওয়া আইনগত মালিকানার প্রমাণ নয়; রেকর্ড না পাওয়াও কোনো ছাড়পত্র নয়।
    <span className="block text-xs mt-1">Results come from the project&apos;s own reference database (dummy data). A match is not proof of legal ownership, and a missing record is not official clearance.</span>
  </Alert>
);
