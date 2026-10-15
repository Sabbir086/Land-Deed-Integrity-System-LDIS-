"use client";
import { useState } from "react";
import { Alert, Button, Card, Field, Input, Select, Spinner } from "@/components/ui";
import { useLookup } from "./api";
import Indicators from "./Indicators";
import { fmtDate } from "@/lib/utils";

const FEES = [["stamp", "স্ট্যাম্প ফি"], ["registration", "রেজিস্ট্রেশন ফি"], ["source_tax", "উৎসে কর"], ["other", "অন্যান্য ফি"]];

export default function ChallanLookup() {
  const [f, setF] = useState({ challan_no: "", amount: "", fee_type: "stamp" });
  const [st, run] = useLookup();
  const d = st.data;
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  return (
    <div className="space-y-4">
      <Card title="চালানের তথ্য" subtitle="শুধু মিলিয়ে দেখা হয়; চালান ‘ব্যবহৃত’ হিসেবে চিহ্নিত হয় না">
        <form onSubmit={(e) => { e.preventDefault(); run("/api/verify/challan", { ...f, amount: Number(f.amount) }); }} className="grid gap-4 sm:grid-cols-4 sm:items-end">
          <Field label="চালান নম্বর" htmlFor="ch-no"><Input id="ch-no" value={f.challan_no} onChange={set("challan_no")} /></Field>
          <Field label="জমার পরিমাণ (টাকা)" htmlFor="ch-amt"><Input id="ch-amt" type="number" min="0" step="0.01" value={f.amount} onChange={set("amount")} /></Field>
          <Field label="ফি-এর ধরন" htmlFor="ch-type"><Select id="ch-type" value={f.fee_type} onChange={set("fee_type")}>{FEES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Select></Field>
          <Button type="submit" disabled={st.loading || !f.challan_no || !f.amount}>Verify</Button>
        </form>
        {st.loading && <div className="mt-3"><Spinner /></div>}
      </Card>
      {st.error && <Alert tone="error">{st.error}</Alert>}
      {d && <Indicators items={d.indicators} />}
      {d?.found && <p className="text-sm text-slate-600">জমার তারিখ (রেকর্ড অনুযায়ী): {fmtDate(d.paid_on)}</p>}
    </div>
  );
}
