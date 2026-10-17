import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Alert, Card, PageHeader } from "@/components/ui";
import StaffActions from "@/components/staff/StaffActions";
import {
  RegistrarChecklistItem,
  RegistrarChecklistProvider,
  RegistrarChecklistSavePanel,
} from "@/components/staff/RegistrarChecklist";

export const dynamic = "force-dynamic";

function value(v) {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "boolean") return v ? "হ্যাঁ" : "না";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}
function Field({ label, value: v }) {
  return <div className="min-w-0 rounded-lg bg-slate-50 p-3"><div className="text-xs text-slate-500">{label}</div><div className="mt-1 break-words text-sm font-medium">{value(v)}</div></div>;
}
function DataTable({ title, rows, fields }) {
  return <Card title={`${title} (${rows?.length || 0})`}>
    {!rows?.length ? <p className="text-sm text-slate-500">কোনো তথ্য পাওয়া যায়নি।</p> : <div className="space-y-3">{rows.map((row, i) => <div key={row.id || i} className="rounded-lg border p-3"><div className="mb-2 font-semibold">{row.name_bn || row.name || row.fee_name || row.challan_no || row.deed_no || `${title} ${i + 1}`}</div><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{fields.filter(([k]) => row[k] !== undefined).map(([k, label]) => <Field key={k} label={label} value={row[k]} />)}</div></div>)}</div>}
  </Card>;
}
function scoreLabel(score) {
  if (score === null || score === undefined || score === "") return "তুলনার তথ্য নেই";
  const n = Number(score);
  return Number.isFinite(n) ? `${Math.round(n * 100)}%` : "—";
}
function OwnershipSummary({ ownership }) {
  if (!ownership) return <Card title="মালিকানা ও পূর্ববর্তী দলিল যাচাই"><p className="text-sm text-slate-500">মালিকানার যাচাইয়ের তথ্য নেই।</p></Card>;
  const routeLabels = { record_owner: "রেকর্ডীয় মালিক (পর্চা)", warish: "ওয়ারিশ সূত্র", baya_deed: "বায়া/পূর্ববর্তী দলিল" };
  const checks = ownership.checks || {};
  return <Card title="মালিকানা ও পূর্ববর্তী দলিল যাচাই">
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <Field label="মালিকানার ভিত্তি" value={routeLabels[ownership.route] || ownership.route} />
      <Field label="পর্চার মালিক" value={ownership.owner_name} />
      <Field label="পিতার নাম" value={ownership.owner_father_name} />
      <Field label="রেকর্ডকৃত অংশ" value={ownership.owner_share} />
      <Field label="নামের মিল" value={scoreLabel(ownership.name_score)} />
      <Field label="পিতা/স্বামীর নামের মিল" value={scoreLabel(ownership.father_score)} />
      <Field label="যাচাইয়ের ফল" value={ownership.identity_outcome || ownership.status} />
      <Field label="প্রত্যয়ন নম্বর" value={ownership.attestation_no || "—"} />
      <Field label="প্রত্যয়ন নম্বরের ফলাফল" value={ownership.attestation_verified ? "আবেদনকারী নম্বর দিয়ে reference database-এ verify করেছেন" : "যাচাই করা হয়নি"} />
      {ownership.route === "warish" && <>
        <Field label="ওয়ারিশ সনদ নম্বর" value={ownership.warish_cert_no} />
        <Field label="দাতার সম্পর্ক" value={ownership.heir_relation} />
        <Field label="ওয়ারিশের অংশ" value={ownership.heir_share} />
      </>}
      {ownership.route === "baya_deed" && <>
        <Field label="পূর্ববর্তী দলিল নম্বর" value={ownership.baya_deed_no} />
        <Field label="পূর্ববর্তী দলিলের তারিখ" value={ownership.baya_deed_date} />
        <Field label="পূর্ববর্তী দলিলের জমি" value={ownership.baya_area} />
      </>}
    </div>
    {checks.attestation_bridges !== undefined && <p className="mt-3 text-sm text-slate-600">রেফারেন্স ডেটাবেজে নামের প্রত্যয়ন মিল: <strong>{checks.attestation_bridges ? "মিল পাওয়া গেছে—মানব যাচাই প্রয়োজন" : "নির্দিষ্ট নাম-ভ্যারিয়েন্টের মিল পাওয়া যায়নি"}</strong></p>}
    {checks.outcome && <p className="mt-2 text-xs text-slate-500">সিস্টেমের মিল-পরীক্ষা: {checks.outcome}। নামের মিল নিজে থেকে মালিকানা বা হস্তান্তরের অধিকার প্রমাণ করে না।</p>}
  </Card>;
}

export default async function RegistrarApplication({ params }) {
  await requireRole(["sub_registrar"]);
  const { data, error } = await createClient().rpc("staff_application_detail", { p_app: params.id });
  if (error || !data?.application) notFound();

  const a = data.application;
  const parties = data.parties || [];
  const plots = data.plots || [];
  const fees = data.fees || [];
  const challans = data.challans || [];
  const documents = data.documents || [];
  const appointments = data.appointments || [];
  const flags = a.flags || [];
  const blockerList = a.blockers || [];
  const governmentMatches = plots.flatMap((p) => Array.isArray(p.khas_matches) ? p.khas_matches.map((m) => ({ ...m, source_dag_no: p.dag_no })) : []);
  const governmentFlag = flags.find((f) => f.code === "GOVT_INTEREST_MATCH");
  const governmentInterest = Boolean(data.government_interest) || governmentMatches.length > 0 || Boolean(governmentFlag);
  const governmentRows = governmentMatches.length ? governmentMatches : (governmentInterest ? [{ record_type: "GOVT_INTEREST_MATCH", dag_no: "—", agency: "—", area: null, reference_note: governmentFlag?.detail || governmentFlag?.bn || "লাইভ রেফারেন্স ডেটাবেজে সরকারি স্বার্থ/নিষেধাজ্ঞার মিল পাওয়া গেছে।" }] : []);
  const ownership = data.ownership || null;
  const nameScore = ownership?.route === "record_owner" && ownership.name_score != null ? Number(ownership.name_score) : null;
  const attestationRequired = nameScore !== null && nameScore >= 0.5 && nameScore < 0.9;
  const affidavitRequired = nameScore !== null && nameScore < 0.5;
  const registrarApproved = Boolean(data.registrar_approved);

  return <>
    <PageHeader title={`Review ${a.application_no}`} titleEn="Application review" actions={<Link className="underline" href="/sub-registrar">Back to queue</Link>} />
    <Alert tone="warn" title="পরীক্ষামূলক পর্যালোচনা">এই সিস্টেমের তথ্য ডেমো/রেফারেন্স ডেটার ওপর ভিত্তি করে। এটি সরকারি নিবন্ধন বা আইনি মালিকানার বিকল্প নয়। নিবন্ধনের আগে প্রতিটি তথ্য যাচাই করুন।</Alert>
    {governmentInterest && <Alert tone="error" title="সরকারি স্বার্থ/নিষেধাজ্ঞার রেকর্ড পাওয়া গেছে — নিবন্ধন করা যাবে না">
      {governmentFlag?.detail || governmentFlag?.bn || "নির্বাচিত দাগের সঙ্গে সরকারি স্বার্থের রেকর্ড মিলেছে।"}
      <p className="mt-1 font-semibold">এই আবেদনে সাব-রেজিস্ট্রারের একমাত্র অনুমোদিত সিদ্ধান্ত হলো প্রত্যাখ্যান (Reject)। অনুমোদন, বায়োমেট্রিক-সম্পন্ন, প্রত্যয়ন/অ্যাফিডেভিট গ্রহণ এবং নিবন্ধন বন্ধ থাকবে।</p>
    </Alert>}

    <RegistrarChecklistProvider applicationId={a.id} readOnly={governmentInterest} canEdit={a.status === "under_review"}>
      <div className="space-y-4">
        <Card title="১. আবেদন ও আবেদনকারী">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="আবেদন নম্বর" value={a.application_no} />
            <Field label="বর্তমান অবস্থা" value={a.status} />
            <Field label="দলিলের প্রকৃতি" value={a.deed_nature} />
            <Field label="দলিলের তারিখ" value={a.deed_date} />
            <Field label="আবেদনকারী" value={data.applicant?.full_name} />
            <Field label="ইমেইল" value={data.applicant?.email} />
            <Field label="জেলা" value={a.district} />
            <Field label="উপজেলা" value={a.upazila} />
            <Field label="মৌজা" value={a.mouza} />
            <Field label="খতিয়ানের ধরন" value={a.khatian_type} />
            <Field label="খতিয়ান নম্বর" value={a.khatian_no} />
            <Field label="বিক্রয়মূল্য" value={a.sale_price} />
            <Field label="বায়োমেট্রিক অবস্থা" value={a.biometric_status} />
            <Field label="আবেদন জমার সময়" value={a.submitted_at} />
          </div>
          <RegistrarChecklistItem itemId={1} />
        </Card>

        <Card title="২. ঝুঁকি সূচক ও সিস্টেম ব্লকার">
          <h3 className="font-semibold">Risk flags</h3>
          {!flags.length ? <p className="mt-2 text-sm text-slate-500">কোনো risk flag নেই।</p> : <div className="mt-2 space-y-2">{flags.map((f, i) => <div key={f.code || i} className={`rounded-lg border p-3 ${f.code === "GOVT_INTEREST_MATCH" ? "border-red-300 bg-red-50" : "border-amber-200"}`}><div className="font-semibold">{f.bn || f.code || `ঝুঁকি ${i + 1}`} <span className="text-xs text-amber-700">{f.level || ""}</span></div><p className="mt-1 text-sm">{f.detail || f.en || "অতিরিক্ত পর্যালোচনা প্রয়োজন।"}</p></div>)}</div>}
          <h3 className="mb-2 mt-4 font-semibold">System blockers</h3>
          {!blockerList.length ? <p className="text-sm text-emerald-700">কোনো সিস্টেম ব্লকার রিপোর্ট করা হয়নি।</p> : <ul className="list-disc space-y-1 pl-5 text-sm">{blockerList.map((b, i) => <li key={i}>{typeof b === "string" ? b : `${b.bn || b.code || "Blocker"}${b.en ? ` — ${b.en}` : ""}`}</li>)}</ul>}
        </Card>

        <section className="space-y-3">
          <DataTable title="দাতা ও গ্রহীতার তথ্য" rows={parties} fields={[["role", "ভূমিকা"], ["name_bn", "পূর্ণ নাম"], ["nid_masked", "NID (গোপন)"], ["dob", "জন্মতারিখ"], ["father_name", "পিতার নাম"], ["mother_name", "মাতার নাম"], ["address", "ঠিকানা"], ["occupation", "পেশা"], ["gender", "লিঙ্গ"], ["verified_at", "যাচাইয়ের সময়"]]} />
          <RegistrarChecklistItem itemId={2} />
          <RegistrarChecklistItem itemId={3} />
        </section>

        <section className="space-y-3">
          <OwnershipSummary ownership={ownership} />
          <RegistrarChecklistItem itemId={4} />
          <RegistrarChecklistItem itemId={5} />
          {attestationRequired && <Alert tone={ownership.attestation_verified ? "success" : "warn"} title="প্রত্যয়ন নম্বর যাচাই · Name match 50%–89%">
            নামের মিল {Math.round(nameScore * 100)}%। {ownership.attestation_verified ? `প্রত্যয়ন নম্বর ${ownership.attestation_no || "—"} আবেদনকারী reference database-এ যাচাই করেছেন।` : "আবেদনকারী এখনো ধাপ ৩-এ প্রত্যয়নপত্র নম্বর দিয়ে যাচাই করেননি।"} ফাইল upload বাধ্যতামূলক নয়; সাব-রেজিস্ট্রার চূড়ান্ত পর্যালোচনা করবেন।
          </Alert>}
          {affidavitRequired && <Alert tone={a.affidavit_declaration ? "success" : "warn"} title="মূল Affidavit এবং সাব-রেজিস্ট্রারের দায়-স্বীকার · Name match below 50%">
            নামের মিল {Math.round(nameScore * 100)}%। Affidavit-এর কোনো database, upload বা online verification নেই। বায়োমেট্রিকের পরে সাব-রেজিস্ট্রার মূল Affidavit দেখেছেন এবং আদালত থেকে ম্যানুয়ালি যাচাই করেছেন—এই ঘোষণা দিয়ে দায় গ্রহণ না করা পর্যন্ত registration হবে না। বর্তমান অবস্থা: {a.affidavit_declaration ? "দায়-স্বীকার ঘোষণা সংরক্ষিত" : "ঘোষণা বাকি"}।
          </Alert>}
        </section>

        <section className="space-y-3">
          <DataTable title="জমির দাগ ও প্লট" rows={plots} fields={[["dag_no", "দাগ নম্বর"], ["dag_area", "মোট জমি"], ["area_sold", "বিক্রয়াধীন জমি"], ["already_sold", "পূর্বে বিক্রিত জমি"], ["remaining", "অবশিষ্ট জমি"], ["land_class", "নির্বাচিত শ্রেণি"], ["recorded_land_class", "রেকর্ডীয় শ্রেণি"], ["other_deeds_count", "অন্যান্য দলিল"]]} />
          <RegistrarChecklistItem itemId={6} />
          <RegistrarChecklistItem itemId={7} />
        </section>

        <section className="space-y-3">
          <DataTable title="সরকারি স্বার্থ ও নিষেধাজ্ঞার রেকর্ড" rows={governmentRows} fields={[["record_type", "ক্যাটাগরি"], ["source_dag_no", "আবেদনের দাগ"], ["dag_no", "রেকর্ডের দাগ"], ["area", "রেকর্ডকৃত জমি"], ["agency", "সরকারি সংস্থা"], ["reference_note", "রেফারেন্স/বিবরণ"]]} />
          {!governmentInterest && <Alert tone="info">সরবরাহকৃত রেফারেন্স ডেটাবেজে কোনো মিল পাওয়া যায়নি। এটি সরকারি ছাড়পত্র নয়।</Alert>}
          <RegistrarChecklistItem itemId={8} />
        </section>

        <section className="space-y-3">
          <DataTable title="দলিলের সাক্ষী" rows={data.witnesses || []} fields={[["serial", "ক্রম"], ["name", "সাক্ষীর নাম"], ["father_name", "পিতার নাম"]]} />
          <DataTable title="সংযুক্ত নথি" rows={documents} fields={[["doc_type", "নথির ধরন"], ["file_name", "ফাইলের নাম"], ["status", "স্ট্যাটাস"], ["created_at", "জমার সময়"]]} />
          <RegistrarChecklistItem itemId={9} />
        </section>

        <section className="space-y-3">
          <DataTable title="ফি-এর বিবরণ" rows={fees} fields={[["name_bn", "ফি-এর নাম"], ["name_en", "Fee type"], ["amount", "পরিমাণ"], ["fee_code", "কোড"], ["is_demo", "ডেমো রেট"], ["challan_type", "চালানের ধরন"]]} />
          <RegistrarChecklistItem itemId={10} />
        </section>

        <section className="space-y-3">
          <DataTable title="চালান যাচাই" rows={challans} fields={[["challan_no", "চালান নম্বর"], ["challan_type", "চালানের ধরন"], ["amount", "পরিমাণ"], ["paid_on", "পরিশোধের তারিখ"], ["verify_status", "স্ট্যাটাস"], ["verified_at", "যাচাইয়ের সময়"]]} />
          <RegistrarChecklistItem itemId={11} />
        </section>

        <section className="space-y-3">
          <DataTable title="অ্যাপয়েন্টমেন্ট" rows={appointments} fields={[["appt_date", "তারিখ"], ["slot", "সময়"], ["purpose", "উদ্দেশ্য"], ["status", "স্ট্যাটাস"], ["office_district", "জেলা অফিস"], ["office_upazila", "উপজেলা অফিস"]]} />
          <RegistrarChecklistItem itemId={12} />
        </section>

        <DataTable title="সংশোধনের অনুরোধ" rows={data.corrections || []} fields={[["message", "কারণ"], ["status", "স্ট্যাটাস"], ["requested_at", "তারিখ"]]} />
        <DataTable title="আবেদনের ইতিহাস" rows={data.history || []} fields={[["from_status", "আগের অবস্থা"], ["to_status", "নতুন অবস্থা"], ["actor_role", "কর্তার ভূমিকা"], ["note", "বিবরণ"], ["created_at", "সময়"]]} />

        <RegistrarChecklistSavePanel />
        <StaffActions
          applicationId={a.id}
          application={a}
          status={a.status}
          ownership={ownership}
          documents={documents}
          appointments={appointments}
          governmentInterest={governmentInterest}
          registrarApproved={registrarApproved}
        />
      </div>
    </RegistrarChecklistProvider>
  </>;
}
