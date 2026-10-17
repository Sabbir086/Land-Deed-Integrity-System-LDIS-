"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button, Card, Field, Input } from "@/components/ui";
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
  const existingWitnesses = view.witnesses || [];
  const [witnesses, setWitnesses] = useState(() => [0, 1].map((i) => ({
    name: existingWitnesses[i]?.name || "", father_name: existingWitnesses[i]?.father_name || ""
  })));
  const donor = view.parties.find((p) => p.role === "donor"); const donees = view.parties.filter((p) => p.role === "donee" || /^donee_\d+$/.test(p.role));
  const hold = (a.flags || []).some((f) => f.level === "high");
  async function submit() {
    setFail(null);
    const cleanWitnesses = witnesses.map((w) => ({ name: w.name.trim(), father_name: w.father_name.trim() }))
      .filter((w) => w.name.length > 0);
    if (cleanWitnesses.length < 1) { setFail("কমপক্ষে একজন সাক্ষীর নাম দিতে হবে।"); return; }
    if (cleanWitnesses.some((w) => w.name.length > 160 || w.father_name.length > 160)) { setFail("সাক্ষীর নাম ১৬০ অক্ষরের মধ্যে দিন।"); return; }
    const witnessSave = await call("witnesses", { witnesses: cleanWitnesses });
    if (witnessSave.error) { setFail(witnessSave.error); return; }
    const r = await call("submit", { accept: true });
    if (r.error) return;
    if (r.data?.ok === false) { setFail("আবেদন এখনো সম্পূর্ণ নয়। The application is not complete yet."); return; }
    router.push(`/dashboard/applications/${a.id}`); router.refresh();
  }
  const rows = [
    ["আবেদন নম্বর", a.application_no], ["দলিলের তারিখ", a.deed_date || "—"], ["দলিলের প্রকৃতি", ({saf_kabala:"সাফ-কবলা দলিল",heba_declaration:"হেবা ঘোষণাপত্র / হেবা দলিল",gift_deed:"দানপত্র দলিল",partition_deed:"বণ্টননামা দলিল",exchange_deed:"বিনিময় দলিল",mortgage_deed:"বন্ধক দলিল",sale_agreement:"বায়নাপত্র / বিক্রয় চুক্তি",release_deed:"দাবি/স্বত্ব ত্যাগ দলিল",will_deed:"অছিয়তনামা",other:"অন্যান্য"})[a.deed_nature] || "—"], ["দাতা", donor?.name_bn || "—"], ["গ্রহীতা", donees.map((p,i)=>`${i+1}. ${p.name_bn || "—"}`).join(" · ") || "—"],
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
      <Card title="সাক্ষীর তথ্য · Deed witnesses">
        <p className="mb-3 text-sm text-slate-600">একজন বা দুইজন সাক্ষীর নাম দিন। সর্বোচ্চ দুইজন সাক্ষী এই demo দলিলের snapshot-এ সংরক্ষিত হবে।</p>
        <div className="grid gap-4 md:grid-cols-2">
          {witnesses.map((w, i) => <div key={i} className="space-y-3 rounded-lg border p-3">
            <h4 className="font-semibold">সাক্ষী {i + 1}</h4>
            <Field label="সাক্ষীর নাম" htmlFor={`witness-name-${i}`}>
              <Input id={`witness-name-${i}`} value={w.name} maxLength={160} onChange={(e) => setWitnesses((old) => old.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} />
            </Field>
            <Field label="সাক্ষীর পিতার নাম (ঐচ্ছিক)" htmlFor={`witness-father-${i}`}>
              <Input id={`witness-father-${i}`} value={w.father_name} maxLength={160} onChange={(e) => setWitnesses((old) => old.map((x, j) => j === i ? { ...x, father_name: e.target.value } : x))} />
            </Field>
          </div>)}
        </div>
      </Card>
      <Card title="ফি ও চালান"><FeeTable items={view.fee_items} total={a.fee_total} /><p className="mt-2 text-sm">যাচাইকৃত চালান: {view.challans.length}টি</p></Card>
      <Indicators items={sortIndicators(a.flags || [])} />
      {hold && <Alert tone="warn">উচ্চ-ঝুঁকির সূচক থাকায় জমা দিলে আবেদন “অসংগতি যাচাইয়ে আটকানো” অবস্থায় যাবে। এটি জালিয়াতির প্রমাণ নয়। With HIGH indicators the application is held for discrepancy review.</Alert>}
      <Card title="ঘোষণা ও চূড়ান্ত জমা · Declaration & final submit">
        <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={ok} onChange={(e) => setOk(e.target.checked)} />
          <span>আমি প্রদত্ত সকল তথ্য যাচাই করে নিশ্চিত করছি। চূড়ান্ত জমার পরে সাধারণ সম্পাদনা বন্ধ হতে পারে এবং কোনো সংশোধন প্রযোজ্য কর্তৃপক্ষের অনুমোদন ও নির্ধারিত প্রক্রিয়ায় করতে হবে।
            <span className="block text-xs text-slate-500">I confirm that I have verified all the information. After final submission normal editing may close; corrections need the authority&apos;s approval.</span></span></label>
        <div className="mt-4"><Button onClick={submit} disabled={busy || !ok || blockers.length > 0 || !a.deed_nature || !witnesses.some((w) => w.name.trim())}>{busy ? "জমা হচ্ছে…" : "Final Submit · চূড়ান্ত জমা"}</Button></div>
        {fail && <div className="mt-3"><Alert tone="error">{fail}</Alert></div>}
      </Card>
    </div>
  );
}
