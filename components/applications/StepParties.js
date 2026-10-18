"use client";
import { useState } from "react";
import { Alert, Badge, Button, Card } from "@/components/ui";
import IdentityFields from "@/components/verify/IdentityFields";
import { fmtDate } from "@/lib/utils";

function toISODate(value) {
  if (!value) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const m = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return "";
  const day=Number(m[1]), month=Number(m[2]), year=Number(m[3]);
  const d=new Date(Date.UTC(year,month-1,day));
  return d.getUTCFullYear()===year && d.getUTCMonth()===month-1 && d.getUTCDate()===day ? `${m[3]}-${m[2].padStart(2,"0")}-${m[1].padStart(2,"0")}` : "";
}

function PartyCard({ role, title, party, call, busy, onRemove }) {
  const [nid, setNid] = useState(""); const [dob, setDob] = useState("");
  const [msg, setMsg] = useState(null); const [editing, setEditing] = useState(!party);
  async function verify(e) {
    e.preventDefault(); setMsg(null);
    const isoDob = toISODate(dob);
    if (!isoDob) { setMsg({ tone:"warn", text:"জন্মতারিখ DD/MM/YYYY ফরম্যাটে সঠিকভাবে দিন।" }); return; }
    const r = await call("party", { role, nid_no: nid, dob: isoDob });
    if (r.error) return;
    if (r.data?.found === false || r.data?.ok === false) { setMsg({ tone:"warn", text:"এই NID ও জন্মতারিখে কোনো রেকর্ড পাওয়া যায়নি।" }); return; }
    setEditing(false); setNid(""); setDob("");
    const n = r.data?.attestations?.length || 0;
    if (n) setMsg({ tone:"info", text:`এই ব্যক্তির সঙ্গে ${n}টি নামের প্রত্যয়ন রেকর্ড যুক্ত আছে।` });
  }
  const rows = party ? [
    ["পূর্ণ নাম", party.name_bn], ["পিতার নাম", party.father_name || "—"], ["মাতার নাম", party.mother_name || "—"],
    ["জন্মতারিখ", fmtDate(party.dob)], ["NID (গোপন)", party.nid_masked], ["ঠিকানা", party.address || "—"], ["পেশা", party.occupation || "—"],
  ] : [];
  return <Card title={title} actions={party && !editing ? <Badge tone="green">রেকর্ড পাওয়া গেছে</Badge> : <Badge tone="amber">যাচাই বাকি</Badge>}>
    {party && !editing && <div className="space-y-3"><dl className="grid grid-cols-[auto,1fr] gap-x-4 gap-y-1.5 text-sm">{rows.map(([k,v])=><div key={k} className="contents"><dt className="text-slate-500">{k}</dt><dd className="font-medium">{v}</dd></div>)}</dl>
      <p className="text-xs text-slate-500">এটি প্রকল্পের রেফারেন্স ডেটাবেজের তথ্য; বাস্তব NID সার্ভারের যাচাই নয়।</p>
      <div className="flex flex-wrap gap-2"><Button variant="secondary" onClick={()=>setEditing(true)} disabled={busy}>ব্যক্তি পরিবর্তন</Button>{onRemove && <Button variant="ghost" onClick={onRemove} disabled={busy}>গ্রহীতা বাদ দিন</Button>}</div>
    </div>}
    {(!party || editing) && <form onSubmit={verify} className="space-y-3">
      <IdentityFields idPrefix={role} nid={nid} dob={dob} onNid={setNid} onDob={setDob} dateFormat="dmy"/>
      <div className="flex flex-wrap gap-2"><Button type="submit" disabled={busy || !nid || !dob}>{busy ? "যাচাই হচ্ছে…" : "যাচাই করুন"}</Button>{party && <Button type="button" variant="ghost" onClick={()=>{setEditing(false);setMsg(null);}}>বাতিল</Button>}</div>
    </form>}
    {msg && <div className="mt-3"><Alert tone={msg.tone}>{msg.text}</Alert></div>}
  </Card>;
}

export default function StepParties({ view, call, busy }) {
  const parties = view.parties || [];
  const donor = parties.find((p)=>p.role==="donor");
  const donees = parties.filter((p)=>p.role==="donee" || /^donee_\d+$/.test(p.role)).sort((a,b)=>a.role==="donee"?-1:b.role==="donee"?1:Number(a.role.split("_")[1])-Number(b.role.split("_")[1]));
  const nextRole = () => { if (!donees.some(p=>p.role==="donee") && !extraRoles.includes("donee")) return "donee"; for(let i=2;i<=10;i++) if(!donees.some(p=>p.role===`donee_${i}`) && !extraRoles.includes(`donee_${i}`)) return `donee_${i}`; return null; };
  const [extraRoles,setExtraRoles] = useState([]);
  function addDonee(){ const role=nextRole(); if(role && !extraRoles.includes(role)) setExtraRoles(v=>[...v,role]); }
  return <div className="space-y-4">
    <Alert tone="info">দাতা ও সকল গ্রহীতার NID এবং জন্মতারিখ DD/MM/YYYY ফরম্যাটে দিন। পূর্ণ NID নম্বর আবেদনে সংরক্ষণ করা হয় না।</Alert>
    <div className="grid gap-4"><PartyCard role="donor" title="দাতা (বিক্রেতা)" party={donor} call={call} busy={busy}/></div>
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-lg font-bold text-slate-900">গ্রহীতা (ক্রেতা)</h3><p className="text-sm text-slate-500">একাধিক গ্রহীতা যোগ করে প্রত্যেকের পরিচয় যাচাই করতে পারবেন।</p></div><Button type="button" variant="secondary" onClick={addDonee} disabled={busy || donees.length+extraRoles.filter(r=>!donees.some(p=>p.role===r)).length>=10 || !nextRole()}>+ গ্রহীতা যোগ করুন</Button></div>
      <div className="grid gap-4 lg:grid-cols-2">
        {donees.map((party,i)=><PartyCard key={party.role} role={party.role} title={`গ্রহীতা ${i+1}`} party={party} call={call} busy={busy}/>)}
        {extraRoles.filter(r=>!donees.some(p=>p.role===r)).map((role,i)=><PartyCard key={role} role={role} title={`নতুন গ্রহীতা ${donees.length+i+1}`} party={null} call={call} busy={busy}/>)}
        {!donees.length&&!extraRoles.length&&<Card title="গ্রহীতা ১"><p className="text-sm text-slate-600">গ্রহীতার তথ্য যোগ করতে “গ্রহীতা যোগ করুন” চাপুন।</p></Card>}
      </div>
    </section>
  </div>;
}
