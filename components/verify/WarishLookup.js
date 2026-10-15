"use client";
import { useState } from "react";
import { Alert, Badge, Button, Card, DataTable, Field, Input, Spinner } from "@/components/ui";
import { useLookup } from "./api";
import Indicators from "./Indicators";
import { fmtDate } from "@/lib/utils";

export default function WarishLookup() {
  const [no, setNo] = useState("");
  const [st, run] = useLookup();
  const d = st.data;
  return (
    <div className="space-y-4">
      <Card title="ওয়ারিশ সার্টিফিকেট নম্বর">
        <form onSubmit={(e) => { e.preventDefault(); run("/api/verify/warish", { cert_no: no }); }} className="grid gap-4 sm:grid-cols-3 sm:items-end">
          <div className="sm:col-span-2"><Field label="সার্টিফিকেট নম্বর · Certificate no." htmlFor="cert-no"><Input id="cert-no" value={no} onChange={(e) => setNo(e.target.value)} /></Field></div>
          <Button type="submit" disabled={st.loading || !no}>অনুসন্ধান</Button>
        </form>
        {st.loading && <div className="mt-3"><Spinner /></div>}
      </Card>
      {st.error && <Alert tone="error">{st.error}</Alert>}
      {d && <Indicators items={d.indicators} />}
      {d?.found && (
        <Card title="সার্টিফিকেটের তথ্য" subtitle="Source: project warish reference tables (dummy data)">
          <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
            {[["নম্বর", d.certificate.cert_no], ["তারিখ", fmtDate(d.certificate.cert_date)], ["মৃত ব্যক্তি", d.certificate.deceased_name], ["মৃত ব্যক্তির পিতা", d.certificate.deceased_father_name], ["ইস্যুকারী কর্তৃপক্ষ", d.certificate.issuing_authority]].map(([k, v]) => (
              <div key={k}><dt className="text-slate-500">{k}</dt><dd className="font-medium">{v || "—"}</dd></div>))}
          </dl>
          <h3 className="mb-2 mt-5 text-sm font-semibold">ওয়ারিশগণ <Badge tone={d.share_status === "OK" ? "green" : "amber"}>অংশের যোগফল {d.share_total}</Badge></h3>
          <DataTable caption="Heirs" rows={d.heirs} columns={[{ key: "serial", label: "ক্রম" }, { key: "name", label: "নাম" }, { key: "father_name", label: "পিতা" }, { key: "relation", label: "সম্পর্ক" }, { key: "share", label: "অংশ" }]} />
          <p className="mt-3 text-xs text-slate-500">ওয়ারিশ অংশ এখানে শুধু রেকর্ড অনুযায়ী দেখানো হচ্ছে (পরীক্ষামূলক নিয়ম); এটি আইনগত উত্তরাধিকার-গণনা নয়। Heir shares are shown as recorded; this is not a legal inheritance calculation.</p>
        </Card>
      )}
    </div>
  );
}
