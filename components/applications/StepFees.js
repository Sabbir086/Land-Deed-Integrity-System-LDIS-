"use client";
import { useState } from "react";
import { Alert, Badge, Button, Card, Field, Input } from "@/components/ui";
import FeeTable from "./FeeTable";
import { CHALLAN_REASON, FEE_TYPE_LABEL } from "@/lib/applications/status";
import { fmtDate } from "@/lib/utils";
import { fmtMoney } from "@/lib/applications/format";

function ChallanCard({ type, due, verified, call, busy }) {
  const [no, setNo] = useState(""); const [amount, setAmount] = useState(String(due)); const [reasons, setReasons] = useState(null);
  const label = FEE_TYPE_LABEL[type] || { bn: type, en: type };
  async function verify(e) {
    e.preventDefault(); setReasons(null);
    const r = await call("challan", { challan_type: type, challan_no: no, amount });
    if (r.error) return;
    if (r.data && r.data.ok === false) setReasons(r.data.reasons || []); else setNo("");
  }
  return (
    <Card title={`${label.bn} চালান · ${label.en}`} subtitle={`প্রদেয় · Due: ${fmtMoney(due)}`} actions={verified ? <Badge tone="green">যাচাইকৃত · Verified</Badge> : <Badge tone="amber">যাচাই বাকি</Badge>}>
      {verified ? (
        <div className="space-y-2 text-sm">
          <p>চালান নং <span className="font-mono font-semibold">{verified.challan_no}</span> · {fmtMoney(verified.amount)} · জমা {fmtDate(verified.paid_on)}</p>
          <p className="text-xs text-slate-500">প্রকল্পের ডেমো রেফারেন্স রেকর্ডের সঙ্গে মিলেছে। এটি বাস্তবে টাকা জমার প্রমাণ নয়। Matched the dummy reference record; not proof of real payment.</p>
          <Button variant="secondary" disabled={busy} onClick={() => call("challan-release", { challan_type: type })}>সরিয়ে নিন · Release</Button>
        </div>
      ) : (
        <form onSubmit={verify} className="space-y-3">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="চালান নম্বর · Challan number" htmlFor={`ch-${type}`}><Input id={`ch-${type}`} autoComplete="off" value={no} onChange={(e) => setNo(e.target.value)} /></Field>
            <Field label="জমার পরিমাণ (টাকা) · Amount" htmlFor={`am-${type}`}><Input id={`am-${type}`} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
          </div>
          <Button type="submit" disabled={busy || !no || !amount}>{busy ? "যাচাই হচ্ছে…" : "Verify · যাচাই করুন"}</Button>
          {reasons && <Alert tone="error" title="চালান যাচাই হয়নি · Not verified"><ul className="list-disc pl-5">{reasons.map((c) => <li key={c}>{CHALLAN_REASON[c] || c}</li>)}</ul></Alert>}
        </form>
      )}
    </Card>
  );
}

export default function StepFees({ view, call, busy }) {
  const items = view.fee_items || [];
  if (items.length === 0) return <Alert tone="warn">আগে ধাপ ৫-এ মূল্য সংরক্ষণ করুন। Save the sale price in step 5 first.</Alert>;
  const due = {};
  items.forEach((i) => { due[i.challan_type] = (due[i.challan_type] || 0) + Number(i.amount); });
  const types = Object.keys(due).filter((t) => due[t] > 0);
  const byType = Object.fromEntries((view.challans || []).map((c) => [c.challan_type, c]));
  return (
    <div className="space-y-4">
      <Card title="ফি-এর হিসাব · Fee breakdown"><FeeTable items={items} total={view.application.fee_total} /></Card>
      <Alert tone="info" title={`${types.length}টি পৃথক চালান জমা দিতে হবে · ${types.length} separate challan(s) required`}>প্রতিটি চালান আলাদাভাবে যাচাই করুন; সব যাচাই না হলে পরবর্তী ধাপে যাওয়া যাবে না। একটি চালান একটি আবেদনেই ব্যবহার করা যাবে।</Alert>
      {types.map((t) => <ChallanCard key={`${t}-${due[t]}-${byType[t]?.id || "x"}`} type={t} due={due[t]} verified={byType[t]} call={call} busy={busy} />)}
      <Alert tone="warn">চালান নম্বর ও পরিমাণ মিললেই টাকা জমা হয়েছে—এমন নিশ্চিত নয়। বাস্তব ব্যবহারে অনুমোদিত সরকারি ই-চালান যাচাই সেবার মাধ্যমে নিশ্চিত করতে হবে। A match does not prove payment; confirm via the official e-challan service before production.</Alert>
    </div>
  );
}
