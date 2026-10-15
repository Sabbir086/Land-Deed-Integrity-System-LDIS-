import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Alert, Card, PageHeader } from "@/components/ui";
import StatusBadge from "@/components/applications/StatusBadge";
import NewApplicationButton from "@/components/applications/NewApplicationButton";
import { fmtDate } from "@/lib/utils";
import { fmtMoney } from "@/lib/applications/format";
import { STEPS } from "@/lib/applications/steps";
import { canEdit } from "@/lib/applications/status";

export const metadata = { title: "আমার আবেদনসমূহ" };
export const dynamic = "force-dynamic";

export default async function MyApplications() {
  await requireRole(["user"]);
  const supabase = createClient();
  // RLS "own applications": a user can only ever read their own rows.
  const { data, error } = await supabase.from("deed_applications")
    .select("id,application_no,status,current_step,upazila,mouza,khatian_no,fee_total,submitted_at,updated_at")
    .order("updated_at", { ascending: false });
  return (
    <>
      <PageHeader title="আমার আবেদনসমূহ" titleEn="My applications" description="খসড়া, জমা দেওয়া ও চলমান আবেদনের অবস্থা।" actions={<NewApplicationButton />} />
      {error && <Alert tone="error">আবেদনের তালিকা লোড করা যায়নি। Could not load applications (are migrations 07–09 installed?).</Alert>}
      {!error && data.length === 0 && <Card><p className="text-sm text-slate-600">এখনো কোনো আবেদন নেই। “নতুন দলিলের আবেদন” চাপুন। · No applications yet.</p></Card>}
      <ul className="space-y-3">
        {(data || []).map((a) => (
          <li key={a.id} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div><Link href={`/dashboard/applications/${a.id}`} className="font-mono text-base font-semibold text-brand-800 underline">{a.application_no}</Link>
                <p className="text-sm text-slate-600">{a.khatian_no ? `${a.upazila}, ${a.mouza} — খতিয়ান ${a.khatian_no}` : "জমি এখনো নির্বাচিত নয়"}</p></div>
              <StatusBadge status={a.status} />
            </div>
            <p className="mt-2 text-xs text-slate-500">আপডেট {fmtDate(a.updated_at)} · ফি {fmtMoney(a.fee_total)}{a.submitted_at ? ` · জমা ${fmtDate(a.submitted_at)}` : ""}{canEdit(a.status) ? ` · বর্তমান ধাপ: ${STEPS[a.current_step - 1]?.bn}` : ""}</p>
            <div className="mt-3 flex gap-3 text-sm">
              <Link className="underline" href={`/dashboard/applications/${a.id}`}>বিস্তারিত</Link>
              {canEdit(a.status) && <Link className="font-semibold text-brand-700 underline" href={`/dashboard/applications/${a.id}/edit`}>{a.status === "draft" ? "চালিয়ে যান" : "সংশোধন করুন"}</Link>}
            </div>
          </li>))}
      </ul>
    </>
  );
}
