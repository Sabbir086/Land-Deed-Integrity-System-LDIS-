"use client";
import { useState } from "react";
import { Alert, Badge, Button, Card, Field, Input, Select } from "@/components/ui";
import { fmtArea, fmtDate } from "@/lib/utils";
import { pct } from "@/lib/applications/format";

const ROUTES = [
  ["record_owner", "রেকর্ডীয় মালিক", "Recorded owner (porcha)"],
  ["warish", "ওয়ারিশ সূত্র", "Inheritance via warish certificate"],
  ["baya_deed", "বায়া দলিল", "Previous (baya) deed"],
];
const STATUS = {
  provisional: ["green", "কোনো অসংগতি পাওয়া যায়নি (প্রাথমিক) · No discrepancy found (provisional)"],
  review: ["amber", "অসংগতি যাচাইয়ে যাবে · Goes to discrepancy review"],
  blocked: ["red", "এই সূত্রে এগোনো যাবে না · Cannot proceed with this basis"],
};

function Result({ o }) {
  if (!o) return null;
  const c = o.checks || {};
  const rows = [];
  if (o.route === "record_owner") rows.push(["নাম মিল · Name match", pct(o.name_score)], ["পিতা/স্বামীর নাম মিল · Father match", pct(o.father_score)], ["ফলাফল · Outcome", o.identity_outcome || "—"], ["পর্চার মালিক", `${o.owner_name || "—"} (অংশ ${o.owner_share ?? "—"})`]);
  if (o.route === "warish") rows.push(["সার্টিফিকেট", `${c.cert_no || o.warish_cert_no} (${fmtDate(c.cert_date)})`], ["মৃত ব্যক্তি", c.deceased_name || "—"], ["ইস্যুকারী", c.issuing_authority || "—"], ["দাতার সম্পর্ক", c.heir_relation || "—"], ["দাতার অংশ", c.heir_share ?? "—"], ["মৃত ব্যক্তি vs পর্চা মিল", `${pct(c.deceased_name_score)} / ${pct(c.deceased_father_score)}`]);
  if (o.route === "baya_deed") rows.push(["পূর্ববর্তী দলিল", c.deed_no ? `${c.deed_no} (${fmtDate(c.deed_date)})` : "—"], ["ধরন · দাগ", `${c.deed_type || "—"} · ${c.dag_no || "—"}`], ["হস্তান্তরিত জমি", c.area_sold != null ? fmtArea(c.area_sold) : "—"], ["গ্রহীতা = বর্তমান দাতা?", c.donee_matches_donor == null ? "—" : c.donee_matches_donor ? "হ্যাঁ · Yes" : "না · No"], ["অফিস", c.sub_office || "—"]);
  return (
    <Card title="যাচাইয়ের ফলাফল · Result" actions={<Badge tone={STATUS[o.status][0]}>{STATUS[o.status][1]}</Badge>}>
      <dl className="grid grid-cols-[auto,1fr] gap-x-4 gap-y-1.5 text-sm">{rows.map(([k, v]) => <div key={k} className="contents"><dt className="text-slate-500">{k}</dt><dd className="font-medium">{String(v)}</dd></div>)}</dl>
      <div className="mt-3"><Alert tone="warn">নামের বা তথ্যের মিল আইনগত মালিকানা বা হস্তান্তরের অধিকার প্রমাণ করে না; সাব-রেজিস্ট্রার চূড়ান্তভাবে যাচাই করবেন। A match does not establish legal ownership or the right to transfer.</Alert></div>
    </Card>
  );
}

export default function StepOwnership({ view, call, busy }) {
  const cur = view.ownership;
  const [route, setRoute] = useState(cur?.route || "record_owner");
  const [ownerId, setOwnerId] = useState(cur?.owner_id || "");
  const [cert, setCert] = useState(cur?.warish_cert_no || "");
  const [deedNo, setDeedNo] = useState(cur?.baya_deed_no || ""); const [deedDate, setDeedDate] = useState(cur?.baya_deed_date || "");
  const donor = (view.parties || []).find((p) => p.role === "donor");
  const owners = view.khatian?.owners || [];
  if (!view.application.khatian_id) return <Alert tone="warn">আগে ধাপ ২-এ খতিয়ান নির্বাচন করুন। Select a khatian in step 2 first.</Alert>;
  if (!donor) return <Alert tone="warn">আগে ধাপ ১-এ দাতার পরিচয় যাচাই করুন। Verify the donor in step 1 first.</Alert>;

  const needsOwner = route !== "baya_deed";
  const ready = (needsOwner ? ownerId : true) && (route !== "warish" || cert) && (route !== "baya_deed" || (deedNo && deedDate));
  function save(e) { e.preventDefault(); call("ownership", { route, owner_id: needsOwner ? ownerId : undefined, cert_no: cert, deed_no: deedNo, deed_date: deedDate }); }
  return (
    <div className="space-y-4">
      <Card title="দাতা কোন সূত্রে জমির মালিক? · How does the donor hold this land?" subtitle={`দাতা: ${donor.name_bn}`}>
        <form onSubmit={save} className="space-y-4">
          <fieldset className="grid gap-2 sm:grid-cols-3">
            <legend className="sr-only">Ownership route</legend>
            {ROUTES.map(([v, bn, en]) => (
              <label key={v} className={`flex cursor-pointer flex-col rounded-md border p-3 text-sm ${route === v ? "border-brand-600 bg-brand-50" : "border-slate-300"}`}>
                <span className="flex items-center gap-2"><input type="radio" name="route" checked={route === v} onChange={() => setRoute(v)} /><span className="font-semibold">{bn}</span></span><span className="ml-6 text-xs text-slate-500">{en}</span>
              </label>))}
          </fieldset>
          {needsOwner && (
            <Field label={route === "warish" ? "পর্চায় মৃত মালিক · Deceased recorded owner" : "পর্চার মালিক (যাঁর কাছ থেকে কিনবেন) · Recorded owner"} htmlFor="o-owner">
              <Select id="o-owner" value={ownerId} onChange={(e) => setOwnerId(e.target.value)}>
                <option value="">— নির্বাচন করুন —</option>
                {owners.map((o) => <option key={o.id} value={o.id}>{o.serial}. {o.owner_name} — {o.father_name || "?"} (অংশ {o.share})</option>)}
              </Select>
            </Field>)}
          {route === "warish" && <Field label="ওয়ারিশ সার্টিফিকেট নম্বর · Certificate number" htmlFor="o-cert" hint="দাতাকে অবশ্যই সার্টিফিকেটের ওয়ারিশ তালিকায় থাকতে হবে"><Input id="o-cert" value={cert} onChange={(e) => setCert(e.target.value)} /></Field>}
          {route === "baya_deed" && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="পূর্ববর্তী দলিল নম্বর · Previous deed no." htmlFor="o-dn" hint="যেমন 5001/2023"><Input id="o-dn" value={deedNo} onChange={(e) => setDeedNo(e.target.value)} /></Field>
              <Field label="দলিলের তারিখ · Deed date" htmlFor="o-dd"><Input id="o-dd" type="date" value={deedDate} onChange={(e) => setDeedDate(e.target.value)} /></Field>
            </div>)}
          <Button type="submit" disabled={busy || !ready}>{busy ? "যাচাই হচ্ছে…" : "যাচাই ও সংরক্ষণ · Verify & save"}</Button>
        </form>
      </Card>
      <Result o={cur} />
    </div>
  );
}
