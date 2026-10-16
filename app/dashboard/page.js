import Link from "next/link";\nimport NewApplicationButton from "@/components/applications/NewApplicationButton";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";



export const dynamic = "force-dynamic";
export const metadata = { title: "ব্যবহারকারী ড্যাশবোর্ড" };

export default async function UserDashboard() {
  const { profile } = await requireRole(["user"]);
  const supabase = createClient();
  const { data: apps } = await supabase.from("deed_applications").select("status");
  const total = (apps || []).length;
  const pending = (apps || []).filter((a) => !["registered", "rejected", "withdrawn"].includes(a.status)).length;
  const tiles = [
    { href: "/dashboard/applications/new", title: "দলিল নিবন্ধনের আবেদন", en: "Apply for deed registration", description: "জমির তথ্য, দাতা-গ্রহীতা যাচাই, ফি ও প্রয়োজনীয় ধাপ সম্পন্ন করুন।", icon: "＋", tone: "from-orange-500 to-amber-500", stat: "নতুন আবেদন শুরু করুন" },
    { href: "/dashboard/applications", title: "আবেদনের অবস্থা", en: "Application status", description: "আপনার খসড়া, জমা দেওয়া আবেদন এবং সর্বশেষ অগ্রগতি দেখুন।", icon: "▤", tone: "from-teal-600 to-cyan-600", stat: `${total}টি আবেদন · ${pending}টি চলমান` },
  ];
  return <main className="space-y-7">
    <div className="rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 p-6 text-white shadow-xl sm:p-9">
      <p className="text-sm font-semibold tracking-wide text-amber-300">LAND DEED INTEGRITY SYSTEM</p>
      <h1 className="mt-3 text-2xl font-bold sm:text-3xl">স্বাগতম, {profile.full_name || profile.email}</h1><p className="mt-2 max-w-2xl text-sm text-slate-300">আপনার দলিল নিবন্ধন আবেদন শুরু করুন অথবা আগের আবেদনের অগ্রগতি দেখুন।</p>
      <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-sm"><span className="h-2 w-2 rounded-full bg-emerald-400" /> ব্যবহারকারী · User</div>
    </div>
    <section className="grid gap-5 md:grid-cols-2">
      {tiles.map(({href,title,en,description,icon,tone,stat},i) => <article key={href} className="group rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-xl">
        <div className={`mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br ${tone} text-white shadow-md`}><span className="text-3xl font-bold">{icon}</span></div>
        <h2 className="text-xl font-bold text-slate-900">{title}</h2><p className="mt-1 text-sm font-medium text-slate-500">{en}</p>
        <p className="mt-4 min-h-12 text-sm leading-6 text-slate-600">{description}</p>
        <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-4"><span className="text-sm font-semibold text-slate-700">{stat}</span><span aria-hidden="true" className="text-xl transition group-hover:-translate-y-1 group-hover:translate-x-1">↗</span></div>
        {i === 0 ? <div className="mt-4"><NewApplicationButton /></div> : <Link className="mt-4 inline-flex font-semibold text-brand-700 underline" href={href}>আবেদনসমূহ দেখুন →</Link>}
      </article>)}
    </section>
  </main>;
}
