"use client";
import { useState } from "react";
import Link from "next/link";

import { Card } from "@/components/ui";
import UserApprovalPanel from "./UserApprovalPanel";

const services = [
  { id:"users", title:"User Approval", subtitle:"ব্যবহারকারী অনুমোদন", detail:"নতুন অ্যাকাউন্ট, role ও দায়িত্বপ্রাপ্ত উপজেলা পরিচালনা", icon:"♙", tone:"from-violet-600 to-indigo-600" },
  { id:"nid", title:"NID Verify", subtitle:"পরিচয় যাচাই", detail:"NID নম্বর দিয়ে রেফারেন্স রেকর্ড যাচাই", href:"/verify/person", icon:"◎", tone:"from-sky-600 to-cyan-600" },
  { id:"deed", title:"Deed Verify", subtitle:"দলিল যাচাই", detail:"দলিল নম্বর দিয়ে অনুসন্ধান", href:"/verify/deed", icon:"⌕", tone:"from-amber-500 to-orange-600" },
  { id:"challan", title:"Chalan Verify", subtitle:"চালান যাচাই", detail:"চালান নম্বর ও ফি যাচাই", href:"/verify/challan", icon:"▤", tone:"from-emerald-600 to-teal-600" },
  { id:"cert", title:"Warish / Prottoyon", subtitle:"সনদ যাচাই", detail:"ওয়ারিশ ও প্রত্যয়নপত্র নম্বর দিয়ে অনুসন্ধান", href:"/verify/warish", icon:"▥", tone:"from-rose-500 to-pink-600" },
  { id:"apps", title:"List of Applications", subtitle:"আবেদনের তালিকা", detail:"সব জমা দেওয়া আবেদন ও workflow status খুলুন", icon:"☷", tone:"from-slate-700 to-slate-900" },
];

export default function AdminWorkspace({ data, error, applications = [], queueError = false, isSuperAdmin = false }) {
  const [active, setActive] = useState("");
  const counts = data?.status_counts || {};
  return <div className="ldis-role-dashboard ldis-admin-dashboard space-y-6">
    <div className="rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 p-6 text-white shadow-xl sm:p-8">
      <p className="text-xs font-bold tracking-[.2em] text-cyan-300">LDIS · ADMINISTRATION</p>
      <h1 className="mt-3 text-2xl font-bold sm:text-3xl">Admin Dashboard</h1>
      <p className="mt-2 max-w-2xl text-sm text-slate-300">অ্যাকাউন্ট, যাচাই সেবা ও নিবন্ধন আবেদন এক জায়গা থেকে পরিচালনা করুন।</p>
    </div>
    {error && <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">Admin summary unavailable. Check database migrations.</p>}
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {services.map((s) => { const Icon=s.icon; const selected=active===s.id; const tile=<div className={`h-full rounded-2xl border p-5 text-left shadow-sm transition hover:-translate-y-1 hover:shadow-lg ${selected?"border-brand-500 ring-2 ring-brand-100":"border-slate-200 bg-white"}`}>
        <div className={`mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${s.tone} text-white`}><span className="text-2xl font-bold">{Icon}</span></div>
        <div className="flex items-start justify-between gap-2"><div><h2 className="font-bold text-slate-900">{s.title}</h2><p className="text-sm font-medium text-slate-500">{s.subtitle}</p></div><span aria-hidden="true" className="text-xl">›</span></div>
        <p className="mt-3 text-sm leading-5 text-slate-600">{s.detail}</p>
      </div>;
      return ["users","apps"].includes(s.id) ? <button key={s.id} onClick={()=>setActive(selected?"":s.id)} aria-expanded={selected} className="text-left">{tile}</button> : <Link key={s.id} href={s.href}>{tile}</Link>; })}
    </section>
    {active==="users" && <section id="user-approval"><UserApprovalPanel /></section>}
    {active==="apps" && <section id="all-applications" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="mb-4 text-xl font-bold">সব জমা দেওয়া আবেদন · Applications</h2>
      {queueError && <p className="mb-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">আবেদনের তালিকা লোড হয়নি। Migration 10 এবং staff_queue permission পরীক্ষা করুন।</p>}
      <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left"><th className="p-3">আবেদন নম্বর</th><th className="p-3">আবেদনকারী</th><th className="p-3">অবস্থা</th><th className="p-3">জমির অবস্থান</th><th className="p-3">জমা</th><th className="p-3">খুলুন</th></tr></thead><tbody>
      {applications.map(a=><tr key={a.id} className="border-b"><td className="p-3 font-mono">{a.application_no}</td><td className="p-3">{a.applicant_name||a.applicant_email||"—"}</td><td className="p-3">{a.status}</td><td className="p-3">{[a.district,a.upazila,a.mouza].filter(Boolean).join(" / ")||"—"}</td><td className="p-3">{a.submitted_at?new Date(a.submitted_at).toLocaleString():"—"}</td><td className="p-3"><Link className="font-semibold text-brand-700 underline" href={`/admin/applications/${a.id}`}>বিস্তারিত</Link></td></tr>)}
      {!applications.length&&<tr><td colSpan="6" className="p-3 text-slate-500">কোনো জমা দেওয়া আবেদন পাওয়া যায়নি।</td></tr>}
      </tbody></table></div>
    </section>}
    <section id="application-summary" className="scroll-mt-6 space-y-4">
      <h2 className="text-xl font-bold text-slate-900">Application overview</h2>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card title="সাধারণ ব্যবহারকারী"><p className="text-3xl font-bold">{data?.users_total ?? "—"}</p></Card>
        <Card title="নিবন্ধন রেকর্ড"><p className="text-3xl font-bold">{data?.registrations_total ?? "—"}</p><p className="mt-1 text-xs text-slate-500">Demo records</p></Card>
        {Object.entries(counts).map(([status,n])=><Card key={status} title={status}><p className="text-3xl font-bold">{n}</p></Card>)}
      </div>
    </section>
  </div>;
}
