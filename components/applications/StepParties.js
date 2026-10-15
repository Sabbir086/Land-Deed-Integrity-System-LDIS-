"use client";
import { useState } from "react";
import { Alert, Badge, Button, Card } from "@/components/ui";
import IdentityFields from "@/components/verify/IdentityFields";
import { fmtDate } from "@/lib/utils";

function PartyCard({ role, title, party, call, busy }) {
  const [nid, setNid] = useState(""); const [dob, setDob] = useState("");
  const [msg, setMsg] = useState(null); const [editing, setEditing] = useState(!party);

  async function verify(e) {
    e.preventDefault(); setMsg(null);
    const r = await call("party", { role, nid_no: nid, dob });
    if (r.error) return;
    if (r.data?.found === false) { setMsg({ tone: "warn", text: "এই NID ও জন্মতারিখে কোনো রেকর্ড পাওয়া যায়নি। (অজানা NID এবং ভুল জন্মতারিখের উত্তর একই।) No record found for this NID and date of birth." }); return; }
    setEditing(false); setNid(""); setDob("");
    const n = r.data?.attestations?.length || 0;
    if (n) setMsg({ tone: "info", text: `${n}টি নামের অমিলের প্রত্যয়নপত্র এই ব্যক্তির সঙ্গে যুক্ত আছে। ${n} name-attestation record(s) exist for this person.` });
  }

  const rows = party ? [
    ["পূর্ণ নাম · Name", party.name_bn], ["পিতার নাম · Father", party.father_name || "—"], ["মাতার নাম · Mother", party.mother_name || "—"],
    ["জন্মতারিখ · DOB", fmtDate(party.dob)], ["NID (masked)", party.nid_masked], ["ঠিকানা · Address", party.address || "—"], ["পেশা · Occupation", party.occupation || "—"],
  ] : [];
  return (
    <Card title={title} actions={party ? <Badge tone="green">যাচাইকৃত রেকর্ড · Record found</Badge> : <Badge tone="amber">যাচাই বাকি</Badge>}>
      {party && !editing && (
        <div className="space-y-3">
          <dl className="grid grid-cols-[auto,1fr] gap-x-4 gap-y-1.5 text-sm">{rows.map(([k, v]) => <div key={k} className="contents"><dt className="text-slate-500">{k}</dt><dd className="font-medium">{v}</dd></div>)}</dl>
          <p className="text-xs text-slate-500">তথ্য স্বয়ংক্রিয়ভাবে প্রকল্পের NID রেফারেন্স ডেটাবেজ থেকে নেওয়া হয়েছে; এটি বাস্তব NID সার্ভারের যাচাই নয়। Auto-filled from the project&apos;s own reference data, not the real NID system.</p>
          <Button variant="secondary" onClick={() => setEditing(true)} disabled={busy}>অন্য ব্যক্তি বেছে নিন · Change person</Button>
        </div>
      )}
      {(!party || editing) && (
        <form onSubmit={verify} className="space-y-3">
          <IdentityFields idPrefix={role} nid={nid} dob={dob} onNid={setNid} onDob={setDob} />
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={busy || !nid || !dob}>{busy ? "যাচাই হচ্ছে…" : "যাচাই করুন · Verify"}</Button>
            {party && <Button type="button" variant="ghost" onClick={() => { setEditing(false); setMsg(null); }}>বাতিল</Button>}
          </div>
        </form>
      )}
      {msg && <div className="mt-3"><Alert tone={msg.tone}>{msg.text}</Alert></div>}
    </Card>
  );
}

export default function StepParties({ view, call, busy }) {
  const by = (r) => (view.parties || []).find((p) => p.role === r);
  return (
    <div className="space-y-4">
      <Alert tone="info">দাতা ও গ্রহীতার NID নম্বর ও জন্মতারিখ দিন। NID নম্বর আবেদনে সংরক্ষিত হয় না (শুধু মাস্কড রূপ)। · The full NID number is not stored, only its masked form.</Alert>
      <div className="grid gap-4 lg:grid-cols-2">
        <PartyCard role="donor" title="দাতা (বিক্রেতা) · Donor / seller" party={by("donor")} call={call} busy={busy} />
        <PartyCard role="donee" title="গ্রহীতা (ক্রেতা) · Donee / buyer" party={by("donee")} call={call} busy={busy} />
      </div>
    </div>
  );
}
