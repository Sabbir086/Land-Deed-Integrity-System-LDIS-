import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Alert, Card, PageHeader } from "@/components/ui";
import StatusBadge from "@/components/applications/StatusBadge";
import NewApplicationButton from "@/components/applications/NewApplicationButton";
import { fmtDate } from "@/lib/utils";
import { fmtMoney } from "@/lib/applications/format";
import { STEPS, LAST_STEP } from "@/lib/applications/steps";
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
  const applications = data || [];

  return (
    <div className="ldis-application-list-page">
      <PageHeader title="আমার আবেদনসমূহ" titleEn="My applications" description="খসড়া, জমা দেওয়া ও চলমান আবেদনের অবস্থা এক জায়গা থেকে দেখুন।" actions={<NewApplicationButton />} />
      <section className="ldis-application-list-intro">
        <div><span className="ldis-application-eyebrow">MY LDIS WORKSPACE</span><h2>আপনার নিবন্ধন যাত্রা</h2><p>যেখানে কাজ থেমেছে, সেখান থেকেই আবেদন চালিয়ে যান।</p></div>
        <div className="ldis-application-list-stat"><strong>{applications.length}</strong><span>মোট আবেদন</span></div>
      </section>

      {error && <Alert tone="error">আবেদনের তালিকা লোড করা যায়নি। Could not load applications (are migrations 07–09 installed?).</Alert>}
      {!error && applications.length === 0 && <Card><div className="ldis-application-empty"><span className="ldis-application-empty-icon">▤</span><h3>এখনো কোনো আবেদন নেই</h3><p>নতুন দলিলের আবেদন শুরু করলে এখানে আপনার অগ্রগতি দেখতে পাবেন।</p></div></Card>}

      {!error && applications.length > 0 && <ul className="ldis-application-grid">
        {applications.map((a) => {
          const stepNo = Math.min(Math.max(Number(a.current_step) || 1, 1), LAST_STEP);
          const registered = a.status === "registered";
          const progress = registered ? 100 : Math.round((stepNo / LAST_STEP) * 100);
          const currentStage = STEPS[stepNo - 1];
          return <li key={a.id} className={`ldis-application-card ${registered ? "is-registered" : ""}`}>
            <div className="ldis-application-card-accent" />
            <div className="ldis-application-card-header">
              <div className="ldis-application-card-number"><span className="ldis-application-card-icon">▤</span><div><small>APPLICATION NO.</small><Link href={`/dashboard/applications/${a.id}`}>{a.application_no}</Link></div></div>
              <StatusBadge status={a.status} />
            </div>
            <p className="ldis-application-land-summary">{a.khatian_no ? `${a.upazila || "উপজেলা উল্লেখ নেই"}, ${a.mouza || "মৌজা উল্লেখ নেই"} — খতিয়ান ${a.khatian_no}` : "জমির তথ্য এখনো নির্বাচন করা হয়নি"}</p>
            <div className="ldis-application-progress-area">
              <div className="ldis-application-progress-label"><span>{registered ? "নিবন্ধন প্রক্রিয়া সম্পন্ন" : `বর্তমান ধাপ ${stepNo} / ${LAST_STEP}`}</span><strong>{progress}%</strong></div>
              <div className="ldis-application-progress-track"><span style={{ width: `${progress}%` }} /></div>
              {!registered && <p>এখন: <strong>{currentStage.bn}</strong><span> · {currentStage.en}</span></p>}
            </div>
            <div className="ldis-application-card-meta">
              <div><span>সর্বশেষ আপডেট</span><strong>{fmtDate(a.updated_at)}</strong></div>
              <div><span>আনুমানিক ফি-র সারাংশ</span><strong>{fmtMoney(a.fee_total)}</strong></div>
              {a.submitted_at && <div><span>আবেদন জমা</span><strong>{fmtDate(a.submitted_at)}</strong></div>}
            </div>
            <div className="ldis-application-card-actions">
              <Link className="ldis-application-secondary-link" href={`/dashboard/applications/${a.id}`}>বিস্তারিত দেখুন <span aria-hidden="true">↗</span></Link>
              {canEdit(a.status) && <Link className="ldis-application-primary-link" href={`/dashboard/applications/${a.id}/edit`}>{a.status === "draft" ? "আবেদন চালিয়ে যান" : "সংশোধন করুন"}<span aria-hidden="true">→</span></Link>}
            </div>
          </li>;
        })}
      </ul>}
    </div>
  );
}
