import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Alert, Badge, Card, DataTable, PageHeader } from "@/components/ui";
import Indicators from "@/components/verify/Indicators";
import StatusBadge from "@/components/applications/StatusBadge";
import FeeTable from "@/components/applications/FeeTable";
import { DetailAppointment, WithdrawButton } from "@/components/applications/DetailActions";
import { canChangeAppointment, canEdit, canWithdraw, statusMeta } from "@/lib/applications/status";
import { STEPS } from "@/lib/applications/steps";
import { sortIndicators } from "@/lib/verify/risk";
import { fmtArea, fmtDate } from "@/lib/utils";
import { fmtDateTime } from "@/lib/applications/format";

export const metadata = { title: "আবেদনের বিস্তারিত" };
export const dynamic = "force-dynamic";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function ApplicationDetail({ params }) {
  await requireRole(["user"]);
  if (!UUID.test(params.id)) notFound();
  const supabase = createClient();
  const { data, error } = await supabase.rpc("app_get", { p_app: params.id });
  if (error || !data?.application) notFound();
  const v = data.application; const a = v.application; const m = statusMeta(a.status);
  const open = (v.corrections || []).filter((c) => !c.resolved_at);
  const donor = v.parties.find((p) => p.role === "donor"); const donee = v.parties.find((p) => p.role === "donee");
  return (
    <>
      <PageHeader title={`আবেদন ${a.application_no}`} titleEn="Application detail" actions={<StatusBadge status={a.status} />}
        description={`${m.explainBn} ${m.explainEn}`} />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {a.status === "correction_requested" && (
            <Alert tone="warn" title="সংশোধনের অনুরোধ · Correction requested">
              {open.length === 0 ? <p>বার্তা পাওয়া যায়নি।</p> : open.map((c) => <div key={c.id}><p>{c.message}</p><p className="text-xs">{fmtDateTime(c.requested_at)}{c.steps?.length ? ` · সংশ্লিষ্ট ধাপ: ${c.steps.map((s) => STEPS[s - 1]?.bn).join(", ")}` : ""}</p></div>)}
            </Alert>)}
          {a.status === "discrepancy_review" && <Alert tone="warn" title="অসংগতি যাচাই · Discrepancy review">নিচের উচ্চ-ঝুঁকির সূচকগুলোর কারণে আবেদন আটকে আছে। এটি জালিয়াতির প্রমাণ নয়।</Alert>}
          <Card title="সারসংক্ষেপ · Summary">
            <dl className="grid grid-cols-[auto,1fr] gap-x-4 gap-y-1.5 text-sm">
              {[["দাতা", donor?.name_bn], ["গ্রহীতা", donee?.name_bn],
                ["জমি", a.khatian_no ? `${a.division} › ${a.district} › ${a.upazila} › ${a.mouza} — ${a.khatian_type} খতিয়ান ${a.khatian_no}` : null],
                ["মালিকানার ভিত্তি", v.ownership ? { record_owner: "রেকর্ডীয় মালিক", warish: "ওয়ারিশ সূত্র", baya_deed: "বায়া দলিল" }[v.ownership.route] : null],
                ["জমা", a.submitted_at ? fmtDateTime(a.submitted_at) : null], ["পুনঃজমা", a.resubmission_count ? `${a.resubmission_count} বার` : null],
                ["বায়োমেট্রিক অবস্থা", a.biometric_status === "completed" ? "সম্পন্ন (অফিস নিশ্চিত)" : "সম্পন্ন নয় (বুকিং ≠ সম্পন্ন)"]].map(([k, val]) => <div key={k} className="contents"><dt className="text-slate-500">{k}</dt><dd className="font-medium">{val || "—"}</dd></div>)}
            </dl>
          </Card>
          <Card title="দাগ ও পরিমাণ"><DataTable caption="Plots" empty="কোনো দাগ নেই" rows={v.plots} columns={[
            { key: "dag_no", label: "দাগ" }, { key: "land_class", label: "শ্রেণি" }, { key: "area_sold", label: "বিক্রি", render: (r) => fmtArea(r.area_sold) },
            { key: "remaining", label: "অবশিষ্ট (আগে)", render: (r) => (r.remaining == null ? "অজানা" : fmtArea(r.remaining)) }, { key: "after_sale", label: "বিক্রির পরে", render: (r) => (r.after_sale == null ? "অজানা" : fmtArea(r.after_sale)) }]} /></Card>
          <Card title="ফি ও চালান"><FeeTable items={v.fee_items} total={a.fee_total} />
            <ul className="mt-3 space-y-1 text-sm">{v.challans.map((c) => <li key={c.id}><Badge tone="green">যাচাইকৃত</Badge> {c.challan_type} — <span className="font-mono">{c.challan_no}</span> ({fmtDate(c.paid_on)})</li>)}</ul></Card>
          <Indicators items={sortIndicators(a.flags || [])} />
          <Card title="অ্যাপয়েন্টমেন্ট · Biometric visit booking">
            <DetailAppointment appId={a.id} appointment={v.appointment} events={v.appointment_events} canChange={canChangeAppointment(a.status)} />
          </Card>
        </div>
        <div className="space-y-4">
          <Card title="অবস্থার ইতিহাস · Status timeline">
            <ol className="relative space-y-4 border-l-2 border-slate-200 pl-4">
              {v.history.map((h, i) => (
                <li key={i} className="text-sm"><span className="absolute -left-[7px] mt-1 h-3 w-3 rounded-full bg-brand-600" aria-hidden="true" />
                  <p className="font-semibold">{statusMeta(h.to_status).bn} <span className="text-xs font-normal text-slate-500">{statusMeta(h.to_status).en}</span></p>
                  <p className="text-xs text-slate-500">{fmtDateTime(h.created_at)} · {h.actor_role}{h.note ? ` — ${h.note}` : ""}</p></li>))}
            </ol>
          </Card>
          <Card title="কার্যক্রম · Actions"><div className="space-y-3">
            {canEdit(a.status) && <Link href={`/dashboard/applications/${a.id}/edit`} className="inline-flex min-h-[40px] items-center rounded-md bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-800">{a.status === "draft" ? "আবেদন চালিয়ে যান" : "সংশোধন করে আবার জমা দিন"}</Link>}
            {canWithdraw(a.status) && <WithdrawButton appId={a.id} />}
            {a.status === "registered" && <Link href={`/registered-deeds/${a.id}/print`} className="inline-flex min-h-[40px] items-center rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white">ডেমো দলিল প্রিন্ট করুন</Link>}
            {!canEdit(a.status) && !canWithdraw(a.status) && a.status !== "registered" && <p className="text-sm text-slate-600">এই অবস্থায় কোনো ব্যবহারকারী-কার্যক্রম নেই।</p>}
            <Link href="/dashboard/applications" className="block text-sm underline">← সব আবেদন</Link></div></Card>
        </div>
      </div>
    </>
  );
}
