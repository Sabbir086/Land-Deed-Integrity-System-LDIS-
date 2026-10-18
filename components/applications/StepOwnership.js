"use client";
import { useState } from "react";
import { Alert, Badge, Button, Card, Field, Input, Select } from "@/components/ui";
import { fmtArea, fmtDate } from "@/lib/utils";
import { pct } from "@/lib/applications/format";
import { isAttestationScore } from "@/lib/applications/steps";

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
  const [attestationNo, setAttestationNo] = useState(view.identity_evidence?.attestation_no || "");
  const [attestationBusy, setAttestationBusy] = useState(false);
  const [attestationMessage, setAttestationMessage] = useState("");
  const donor = (view.parties || []).find((p) => p.role === "donor");
  const owners = view.khatian?.owners || [];
  if (!view.application.khatian_id) return <Alert tone="warn">আগে ধাপ ২-এ খতিয়ান নির্বাচন করুন। Select a khatian in step 2 first.</Alert>;
  if (!donor) return <Alert tone="warn">আগে ধাপ ১-এ দাতার পরিচয় যাচাই করুন। Verify the donor in step 1 first.</Alert>;

  const needsOwner = route !== "baya_deed";
  const ready = (needsOwner ? ownerId : true) && (route !== "warish" || cert) && (route !== "baya_deed" || (deedNo && deedDate));
  const identityEvidence = view.identity_evidence || {};
  const nameScore = cur?.route === "record_owner" && cur.name_score != null ? Number(cur.name_score) : null;
  const fatherScore = cur?.route === "record_owner" && cur.father_score != null ? Number(cur.father_score) : null;
  const attestationRequired = isAttestationScore(nameScore) || isAttestationScore(fatherScore);
  const attestationVerified = identityEvidence.attestation_verified === true && identityEvidence.attestation_no === attestationNo.trim();
  function save(e) { e.preventDefault(); call("ownership", { route, owner_id: needsOwner ? ownerId : undefined, cert_no: cert, deed_no: deedNo, deed_date: deedDate }); }
  async function verifyAttestation() {
    setAttestationMessage("");
    setAttestationBusy(true);
    try {
      const result = await call("attestation-verify", { attestation_no: attestationNo.trim() });
      if (result.error) setAttestationMessage(result.error);
      else {
        if (result.data?.verified && result.data?.attestation?.attestation_no) {
          // Use the canonical number returned from the reference record so Bangla digits/case variants
          // do not make a successful database verification look unverified in the UI.
          setAttestationNo(result.data.attestation.attestation_no);
        }
        setAttestationMessage(result.data?.message || (result.data?.verified ? "প্রত্যয়ন নম্বর যাচাই হয়েছে।" : "প্রত্যয়ন নম্বর যাচাই করা যায়নি।"));
      }
    } catch {
      setAttestationMessage("প্রত্যয়ন যাচাই করা যায়নি। আবার চেষ্টা করুন।");
    } finally {
      setAttestationBusy(false);
    }
  }
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
      {attestationRequired && (
        <Card title="প্রত্যয়নপত্র নম্বর দিয়ে যাচাই · Verify attestation by certificate number">
          <p className="mb-3 text-sm text-slate-600">
            নামের মিল {nameScore === null ? "—" : `${Math.round(nameScore * 100)}%`} এবং পিতার নামের মিল {fatherScore === null ? "—" : `${Math.round(fatherScore * 100)}%`}। যেকোনো একটি ৫০%–৯০%-এর কম হলে প্রত্যয়নপত্রের নম্বর দিয়ে reference database-এ যাচাই করুন।
          </p>
          <form onSubmit={(e) => { e.preventDefault(); verifyAttestation(); }} className="space-y-3">
            <Field label="প্রত্যয়নপত্র নম্বর · Attestation number" htmlFor="owner-attestation-no" hint="প্রত্যয়নপত্রে থাকা নম্বর হুবহু লিখুন।">
              <Input id="owner-attestation-no" value={attestationNo} onChange={(e) => { setAttestationNo(e.target.value); setAttestationMessage(""); }} maxLength={80} required />
            </Field>
            <Button type="submit" disabled={attestationBusy || busy || !attestationNo.trim()}>
              {attestationBusy ? "যাচাই হচ্ছে…" : "প্রত্যয়ন নম্বর যাচাই করুন · Verify number"}
            </Button>
          </form>
          {attestationVerified && <Alert tone="success" title="প্রত্যয়ন নম্বর যাচাই সফল">
            নম্বর: <strong>{identityEvidence.attestation_no}</strong>। রেফারেন্স রেকর্ডে এই নম্বর এবং দাতার নাম-ভ্যারিয়েন্টের মিল পাওয়া গেছে। সাব-রেজিস্ট্রার চূড়ান্ত পর্যালোচনা করবেন।
          </Alert>}
          {attestationMessage && !attestationVerified && <Alert tone="warn">{attestationMessage}</Alert>}
          <p className="mt-3 text-xs text-slate-500">এই যাচাই কেবল নম্বর ও সংরক্ষিত নাম-ভ্যারিয়েন্টের মিল নিশ্চিত করে; নিজে থেকে আইনগত মালিকানা প্রতিষ্ঠা করে না।</p>
        </Card>
      )}
      {cur?.route === "record_owner" && cur.name_score != null && Number(cur.name_score) < 0.5 && (
        <Alert tone="warn" title="নামের মিল ৫০%-এর নিচে: মূল Affidavit দেখাতে হবে">
          Affidavit-এর কোনো নম্বর, upload, database বা online verification নেই। আবেদনকারী বায়োমেট্রিকের দিন মূল Affidavit দেখাবেন। এরপর সাব-রেজিস্ট্রার মূল কপি দেখে আদালত থেকে manual verification করার ঘোষণা এবং অসঙ্গতির দায় নিজের বলে স্বীকার না করা পর্যন্ত DEMO registration এগোবে না।
        </Alert>
      )}
    </div>
  );
}
