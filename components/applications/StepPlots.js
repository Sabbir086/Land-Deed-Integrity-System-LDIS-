"use client";
import { useMemo, useState } from "react";
import { Alert, Badge, Button, Card, DataTable, Field, Input } from "@/components/ui";
import { fmtArea, fmtDate } from "@/lib/utils";

function Analysis({ p }) {
  const h = p.history || {};
  const rows = [
    ["দাতার প্রাপ্য অংশ · Entitled", p.entitled], ["পূর্বে বিক্রি করা হয়েছে · Already sold", p.already_sold], ["অবশিষ্ট জমি · Remaining", p.remaining],
    ["নতুন আবেদনে বিক্রি · Selling now", p.area_sold], ["নতুন বিক্রির পরে অবশিষ্ট · After this sale", p.after_sale],
  ];
  const deedCols = [{ key: "deed_no", label: "দলিল নং" }, { key: "deed_date", label: "তারিখ", render: (r) => fmtDate(r.deed_date) }, { key: "area_sold", label: "পরিমাণ", render: (r) => fmtArea(r.area_sold) }];
  return (
    <Card title={`দাগ ${p.dag_no} — হিসাব ও ইতিহাস`} subtitle={`দাগের মোট জমি ${fmtArea(p.dag_area)} · পর্চার শ্রেণি ${p.recorded_land_class || "—"}`}>
      <div className="space-y-4">
        <table className="w-full max-w-md text-sm"><caption className="sr-only">Remaining land</caption><tbody>
          {rows.map(([k, v]) => <tr key={k} className="border-b border-slate-100"><th scope="row" className="py-1.5 pr-4 text-left font-normal text-slate-600">{k}</th><td className="py-1.5 text-right font-semibold">{v == null ? "অজানা" : fmtArea(v)}</td></tr>)}
        </tbody></table>
        {p.entitled == null && <Alert tone="warn">প্রাপ্য অংশ নির্ণয় করা যায়নি (মালিকানার সূত্র অসম্পূর্ণ/অসংগত)। অতিরিক্ত-বিক্রয় পরীক্ষা সম্ভব হয়নি; পর্যালোচক সিদ্ধান্ত নেবেন। Entitlement could not be computed, so the over-sale check was skipped.</Alert>}
        <details className="text-xs text-slate-600"><summary className="cursor-pointer font-medium">ধারণা ও সীমাবদ্ধতা · Assumptions (unconfirmed rules)</summary><ul className="mt-1 list-disc pl-5">{(p.assumptions || []).map((a) => <li key={a}>{a}</li>)}</ul></details>
        <div className="grid gap-4 lg:grid-cols-2">
          <div><h4 className="mb-1 text-sm font-semibold">বর্তমান দাতার পূর্ববর্তী বিক্রয়</h4><DataTable caption="Donor sales" columns={[...deedCols, { key: "donee_name", label: "গ্রহীতা" }]} rows={h.donor_sales || []} empty="কোনো রেকর্ড নেই" /></div>
          <div><h4 className="mb-1 text-sm font-semibold">অন্য দাতার দলিল (একই দাগ)</h4><DataTable caption="Other deeds" columns={[...deedCols, { key: "donor_name", label: "দাতা" }]} rows={h.other_deeds || []} empty="কোনো রেকর্ড নেই" /></div>
        </div>
        <p className="text-xs text-slate-500">একই দাগে দলিল থাকা মানেই জালিয়াতি নয়; সীমানা, অংশ ও হস্তান্তর যাচাই প্রয়োজন। Deeds on the same dag are not fraud by themselves.</p>
        {(p.khas_matches || []).length > 0
          ? <Alert tone="error" title="সরকারি স্বার্থের রেকর্ড পাওয়া গেছে — আবেদন পর্যালোচনায় আটকে থাকবে">{p.khas_matches.map((m, i) => <p key={i}>{m.record_type}{m.agency ? ` — ${m.agency}` : ""}{m.reference_note ? ` (${m.reference_note})` : ""}</p>)}</Alert>
          : <Alert tone="info">সরবরাহকৃত ডেটাবেজে কোনো সরকারি স্বার্থের রেকর্ড পাওয়া যায়নি। এটি ছাড়পত্র নয়। No record in the supplied database. This is NOT clearance.</Alert>}
      </div>
    </Card>
  );
}

export default function StepPlots({ view, call, busy }) {
  const dags = view.khatian?.dags || [];
  const [sel, setSel] = useState(() => Object.fromEntries((view.plots || []).map((p) => [p.dag_id, p.area_sold == null ? "" : String(p.area_sold)])));
  const ready = !!view.ownership && view.ownership.status !== "blocked";
  const chosen = useMemo(() => Object.keys(sel), [sel]);
  if (!view.application.khatian_id) return <Alert tone="warn">আগে খতিয়ান নির্বাচন করুন (ধাপ ২)।</Alert>;
  if (!ready) return <Alert tone="warn">আগে মালিকানার ভিত্তি যাচাই করুন (ধাপ ৩)। Complete the ownership basis (step 3) first.</Alert>;
  const toggle = (id) => setSel((s) => { const n = { ...s }; if (id in n) delete n[id]; else n[id] = ""; return n; });
  const save = (e) => { e.preventDefault(); call("plots", { plots: chosen.map((id) => ({ dag_id: id, area_sold: sel[id] })) }); };
  return (
    <div className="space-y-4">
      <Card title="দাগ নির্বাচন ও বিক্রির পরিমাণ · Select dags and area" subtitle="এক বা একাধিক দাগ; পরিমাণ শতকে (সর্বোচ্চ ৪ দশমিক)">
        <form onSubmit={save} className="space-y-3">
          {dags.length === 0 && <Alert tone="info">এই খতিয়ানে কোনো দাগ নেই।</Alert>}
          <ul className="space-y-2">
            {dags.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center gap-3 rounded-md border border-slate-200 p-3">
                <label className="flex min-w-[12rem] items-center gap-2 text-sm"><input type="checkbox" checked={d.id in sel} onChange={() => toggle(d.id)} />
                  <span><span className="font-semibold">দাগ {d.dag_no}</span> · {d.land_class || "—"} · {fmtArea(d.area)}</span></label>
                {d.id in sel && <div className="w-44"><Field label="বিক্রির পরিমাণ (শতক)" htmlFor={`a-${d.id}`}><Input id={`a-${d.id}`} inputMode="decimal" value={sel[d.id]} onChange={(e) => setSel((s) => ({ ...s, [d.id]: e.target.value }))} /></Field></div>}
              </li>))}
          </ul>
          <Button type="submit" disabled={busy || chosen.length === 0}>{busy ? "যাচাই হচ্ছে…" : "ইতিহাস যাচাই ও সংরক্ষণ · Check history & save"}</Button>
          <p className="text-xs text-slate-500">প্রথমে শুধু দাগ নির্বাচন করে সংরক্ষণ করলে ইতিহাস ও অবশিষ্ট জমি দেখতে পারবেন; এরপর পরিমাণ দিন। Save once without an area to see history and remaining land, then enter the area.</p>
        </form>
      </Card>
      {(view.plots || []).map((p) => <Analysis key={p.id} p={p} />)}
    </div>
  );
}
