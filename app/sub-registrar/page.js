import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";


export const dynamic = "force-dynamic";
export const metadata = { title: "সাব-রেজিস্ট্রার workspace" };

const services = [
  { href:"#queue", title:"Assigned Deed Applications", bn:"দায়িত্বপ্রাপ্ত দলিল আবেদন", text:"নিজ দায়িত্বপ্রাপ্ত উপজেলার আবেদন দেখুন ও সিদ্ধান্ত দিন।", icon:"☷", color:"from-indigo-600 to-blue-700" },
  { href:"/verify/person", title:"NID Verify", bn:"NID যাচাই", text:"NID নম্বর দিয়ে পরিচয় রেকর্ড যাচাই করুন।", icon:"◎", color:"from-sky-600 to-cyan-600" },
  { href:"/verify/deed", title:"Deed Verify", bn:"দলিল যাচাই", text:"দলিল নম্বর দিয়ে রেকর্ড খুঁজুন।", icon:"⌕", color:"from-amber-500 to-orange-600" },
  { href:"/verify/challan", title:"Chalan Verify", bn:"চালান যাচাই", text:"চালান নম্বর ও ফি-এর তথ্য মিলিয়ে দেখুন।", icon:"▤", color:"from-emerald-600 to-teal-600" },
  { href:"/verify/warish", title:"Warish / Prottoyon", bn:"সনদ যাচাই", text:"ওয়ারিশ ও প্রত্যয়নপত্র নম্বর দিয়ে অনুসন্ধান।", icon:"▥", color:"from-rose-500 to-pink-600" },
  { href:"/verify/land", title:"Land & Porcha Verify", bn:"জমি ও পর্চা যাচাই", text:"খতিয়ান, দাগ ও জমির রেফারেন্স তথ্য দেখুন।", icon:"⌖", color:"from-slate-700 to-slate-900" },
];

export default async function SubRegistrarDashboard() {
  const { profile } = await requireRole(["sub_registrar"]);
  const { data, error } = await createClient().rpc("staff_queue", { p_status: null });
  const rows = data?.applications || [];
  return <main className="ldis-role-dashboard ldis-subregistrar-dashboard space-y-6">
    <div className="rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-teal-950 p-6 text-white shadow-xl sm:p-8">
      <p className="text-xs font-bold tracking-[.2em] text-teal-300">LDIS · SUB-REGISTRAR</p>
      <h1 className="mt-3 text-2xl font-bold sm:text-3xl">{profile.full_name || profile.email}</h1>
      <p className="mt-1 text-sm text-slate-300">সাব-রেজিস্ট্রার · Sub-Registrar</p>
      <p className="mt-3 inline-flex rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-sm">দায়িত্বপ্রাপ্ত উপজেলা: {profile.upazila || "বরাদ্দ হয়নি"} · {profile.district || "জেলা বরাদ্দ হয়নি"}</p>
      <div className="mt-5 flex flex-wrap gap-3"><span className="rounded-xl bg-white/10 px-4 py-3"><b className="block text-2xl">{rows.length}</b><small className="text-slate-300">Assigned applications</small></span></div>
    </div>
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {services.map((s) => { const Icon=s.icon; return <Link key={s.href+s.title} href={s.href} className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
        <div className={`mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${s.color} text-white`}><span className="text-2xl font-bold">{Icon}</span></div>
        <h2 className="font-bold text-slate-900">{s.title}</h2><p className="mt-1 text-sm font-medium text-slate-500">{s.bn}</p>
        <p className="mt-3 text-sm leading-6 text-slate-600">{s.text}</p><span className="mt-4 block text-sm font-semibold text-brand-700">খুলুন →</span>
      </Link>; })}
    </section>
    <section id="queue" className="scroll-mt-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="mb-4 text-xl font-bold">দায়িত্বপ্রাপ্ত আবেদনের তালিকা · Application queue</h2>
      {error && <p className="mb-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Queue unavailable. Verify migrations and office routing fields.</p>}
      <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left"><th className="p-3">Application</th><th className="p-3">Status</th><th className="p-3">Location</th><th className="p-3">Submitted</th><th className="p-3">Open</th></tr></thead><tbody>{rows.map(a=><tr key={a.id} className="border-b"><td className="p-3">{a.application_no}</td><td className="p-3">{a.status}</td><td className="p-3">{[a.district,a.upazila,a.mouza].filter(Boolean).join(" / ")||"—"}</td><td className="p-3">{a.submitted_at?new Date(a.submitted_at).toLocaleString():"—"}</td><td className="p-3"><Link className="font-semibold text-brand-700 underline" href={`/sub-registrar/applications/${a.id}`}>Review</Link></td></tr>)}{!rows.length&&<tr><td colSpan="5" className="p-3 text-slate-500">এই উপজেলায় কোনো জমা দেওয়া আবেদন নেই।</td></tr>}</tbody></table></div>
    </section>
  </main>;
}
