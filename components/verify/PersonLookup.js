"use client";
import { useState } from "react";
import { Alert, Button, Card, DataTable, Spinner } from "@/components/ui";
import IdentityFields from "./IdentityFields";
import { useLookup } from "./api";
import { fmtDate } from "@/lib/utils";

export default function PersonLookup() {
  const [nid, setNid] = useState(""); const [dob, setDob] = useState("");
  const [st, run] = useLookup();
  const d = st.data;
  return (
    <div className="space-y-4">
      <Card title="NID নম্বর ও জন্মতারিখ (ঐচ্ছিক)" subtitle="NID নম্বর আবশ্যক; জন্মতারিখ দিলে ফলাফল আরও নির্ভুল হয়">
        <form onSubmit={(e) => { e.preventDefault(); run("/api/verify/nid", { nid_no: nid, dob }); }} className="space-y-4">
          <IdentityFields nid={nid} dob={dob} onNid={setNid} onDob={setDob} />
          <Button type="submit" disabled={st.loading || !nid}>যাচাই করুন</Button>
          {st.loading && <Spinner />}
        </form>
      </Card>
      {st.error && <Alert tone="error">{st.error}</Alert>}
      {d && !d.found && <Alert tone="warn" title="কোনো রেকর্ড পাওয়া যায়নি">এই NID ও জন্মতারিখের সংমিশ্রণে প্রকল্পের ডেটাবেজে রেকর্ড নেই। (এটি বাস্তব NID সিস্টেমের ফলাফল নয়; রেকর্ড না থাকা মানে ব্যক্তি অস্তিত্বহীন নয়।)</Alert>}
      {d?.found && (
        <Card title="প্রাপ্ত রেকর্ড" subtitle="Source: project NID reference table (dummy data) — not the national NID system">
          <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
            {[["নাম", d.person.name_bn], ["NID", d.person.nid_masked], ["পিতা", d.person.father_name], ["মাতা", d.person.mother_name], ["জন্মতারিখ", fmtDate(d.person.dob)], ["লিঙ্গ", d.person.gender], ["ঠিকানা", d.person.address], ["পেশা", d.person.occupation]].map(([k, v]) => (
              <div key={k}><dt className="text-slate-500">{k}</dt><dd className="font-medium">{v || "—"}</dd></div>))}
          </dl>
          <h3 className="mb-2 mt-5 text-sm font-semibold">নামের অমিলের প্রত্যয়নপত্র</h3>
          <DataTable caption="Name attestations" rows={d.attestations} empty="এই ব্যক্তির কোনো প্রত্যয়নপত্র রেকর্ড নেই"
            columns={[{ key: "attestation_no", label: "নম্বর" }, { key: "issued_by", label: "ইস্যুকারী" }, { key: "issue_date", label: "তারিখ", render: (r) => fmtDate(r.issue_date) }, { key: "name_variant_a", label: "নাম (ক)" }, { key: "name_variant_b", label: "নাম (খ)" }, { key: "note", label: "মন্তব্য" }]} />
        </Card>
      )}
    </div>
  );
}
