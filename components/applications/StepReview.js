"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button, Card } from "@/components/ui";
import Indicators from "@/components/verify/Indicators";
import FeeTable from "./FeeTable";
import { fmtArea, fmtDate } from "@/lib/utils";
import { fmtDay } from "@/lib/applications/format";
import { STEPS } from "@/lib/applications/steps";
import { sortIndicators } from "@/lib/verify/risk";

export default function StepReview({ view, call, busy, go }) {
  const router = useRouter();
  const a = view.application; const blockers = a.blockers || [];
  const [ok, setOk] = useState(false); const [fail, setFail] = useState(null);
  const donor = view.parties.find((p) => p.role === "donor"); const donee = view.parties.find((p) => p.role === "donee");
  const hold = (a.flags || []).some((f) => f.level === "high");
  async function submit() {
    setFail(null);
    const r = await call("submit", { accept: true });
    if (r.error) return;
    if (r.data?.ok === false) { setFail("আবেদন এখনো সম্পূর্ণ নয়। The application is not complete yet."); return; }
    router.push(`/dashboard/applications/${a.id}`); router.refresh();
  }
  const rows = [
    ["আবেদন নম্বর", a.application_no], ["দাতা", donor?.name_bn || "—"], ["গ্রহীতা", donee?.name_bn || "—"],
    ["জমি", a.khatian_no ? `${a.upazila}, ${a.mouza} — ${a.khatian_type} খতিয়ান ${a.khatian_no}` : "—"],
    ["মালিকানার ভিত্তি", view.ownership ? { record_owner: "রেকর্ডীয় মালিক", warish: "ওয়ারিশ সূত্র", baya_deed: "বায়া দলিল" }[view.ownership.route] : "—"],
    ["বিক্রয়মূল্য", a.sale_price != null ? `৳ ${Number(a.sale_price).toLocaleString("en-IN")}` : "—"],
    ["বায়োমেট্রিক তারিখ", view.appointment ? `${fmtDay(view.appointment.appt_date)} ${view.appointment.slot} (বুকিং; সম্পন্ন নয়)` : "—"],
  ];
  return (
    <div className="space-y-4">
      {blockers.length > 0 && (
        <Alert tone="error" title="জমা দেওয়ার আগে এগুলো সম্পন্ন করুন · Complete these before submitting">
          <ul className="list-disc pl-5">{blockers.map((b, i) => <li key={`${b.code}-${i}`}>{b.bn} <span className="text-xs">({b.en})</span> <button type="button" className="text-brand-700 underline" onClick={() => go(b.step)}>ধাপ {b.step}: {STEPS[b.step - 1]?.bn}</button></li>)}</ul>
        </Alert>)}
      <Card title="আবেদনের সারসংক্ষেপ · Summary">
        <dl className="grid grid-cols-[auto,1fr] gap-x-4 gap-y-1.5 text-sm">{rows.map(([k, v]) => <div key={k} className="contents"><dt className="text-slate-500">{k}</dt><dd className="font-medium">{v}</dd></div>)}</dl>
        {view.plots.length > 0 && <ul className="mt-3 space-y-1 text-sm">{view.plots.map((p) => <li key={p.id}>দাগ {p.dag_no}: {fmtArea(p.area_sold)} · {p.land_class || "শ্রেণি নেই"} · অবশিষ্ট (বিক্রির পরে) {p.after_sale == null ? "অজানা" : fmtArea(p.after_sale)}</li>)}</ul>}
      </Card>
      <Card title="ফি ও চালান"><FeeTable items={view.fee_items} total={a.fee_total} /><p className="mt-2 text-sm">যাচাইকৃত চালান: {view.challans.length}টি</p></Card>
      <Indicators items={sortIndicators(a.flags || [])} />
      {hold && <Alert tone="warn">উচ্চ-ঝুঁকির সূচক থাকায় জমা দিলে আবেদন “অসংগতি যাচাইয়ে আটকানো” অবস্থায় যাবে। এটি জালিয়াতির প্রমাণ নয়। With HIGH indicators the application is held for discrepancy review.</Alert>}
      <Card title="ঘোষণা ও চূড়ান্ত জমা · Declaration & final submit">
        <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={ok} onChange={(e) => setOk(e.target.checked)} />
          <span>আমি প্রদত্ত সকল তথ্য যাচাই করে নিশ্চিত করছি। চূড়ান্ত জমার পরে সাধারণ সম্পাদনা বন্ধ হতে পারে এবং কোনো সংশোধন প্রযোজ্য কর্তৃপক্ষের অনুমোদন ও নির্ধারিত প্রক্রিয়ায় করতে হবে।
            <span className="block text-xs text-slate-500">I confirm that I have verified all the information. After final submission normal editing may close; corrections need the authority&apos;s approval.</span></span></label>
        <div className="mt-4"><Button onClick={submit} disabled={busy || !ok || blockers.length > 0}>{busy ? "জমা হচ্ছে…" : "Final Submit · চূড়ান্ত জমা"}</Button></div>
        {fail && <div className="mt-3"><Alert tone="error">{fail}</Alert></div>}
      </Card>
    </div>
  );
}
