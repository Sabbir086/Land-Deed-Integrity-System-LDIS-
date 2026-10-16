import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Alert, Card, PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function AdminApplicationDetail({ params }) {
  await requireRole(["admin"]);
  const { data, error } = await createClient().rpc("staff_application_detail", { p_app: params.id });
  if (error || !data?.application) notFound();
  const a=data.application;
  return <main className="space-y-5">
    <PageHeader title={`আবেদন ${a.application_no}`} titleEn="Application details" actions={<Link className="font-semibold text-brand-700 underline" href="/admin">ড্যাশবোর্ডে ফিরুন</Link>} />
    <Alert tone="info">এটি প্রশাসনিক পর্যালোচনার জন্য আবেদন-তথ্য। চূড়ান্ত দলিল নিবন্ধনের কাজ দায়িত্বপ্রাপ্ত সাব-রেজিস্ট্রার করবেন।</Alert>
    <div className="grid gap-4 md:grid-cols-2">
      <Card title="আবেদন ও আবেদনকারী"><dl className="space-y-2 text-sm">
        <div><dt className="text-slate-500">অবস্থা</dt><dd className="font-semibold">{a.status}</dd></div>
        <div><dt className="text-slate-500">আবেদনকারী</dt><dd>{data.applicant?.full_name||"—"} ({data.applicant?.email||"—"})</dd></div>
        <div><dt className="text-slate-500">অবস্থান</dt><dd>{[a.district,a.upazila,a.mouza].filter(Boolean).join(" / ")||"—"}</dd></div>
        <div><dt className="text-slate-500">খতিয়ান</dt><dd>{a.khatian_type||"—"} {a.khatian_no||""}</dd></div>
        <div><dt className="text-slate-500">বিক্রয়মূল্য</dt><dd>{a.sale_price??"—"}</dd></div>
        <div><dt className="text-slate-500">বায়োমেট্রিক অবস্থা</dt><dd>{a.biometric_status||"—"}</dd></div>
      </dl></Card>
      <Card title="ঝুঁকি সূচক ও নথি"><h3 className="font-semibold">Risk flags</h3><pre className="mt-2 whitespace-pre-wrap break-words text-xs">{JSON.stringify(a.flags||[],null,2)}</pre><h3 className="mt-4 font-semibold">Documents</h3><pre className="mt-2 whitespace-pre-wrap break-words text-xs">{JSON.stringify(data.documents||[],null,2)}</pre></Card>
    </div>
  </main>;
}
