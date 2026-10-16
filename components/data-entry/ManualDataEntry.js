"use client";
import { useState } from "react";

const forms = {
  echallans: { title: "E-Challan তথ্য", fields: [
    ["challan_no","E-Challan নম্বর","text",true],["amount","জমার পরিমাণ (টাকা)","number",true],
    ["fee_type","কোন খাতে জমা","select",true,["stamp","registration","source_tax","other"]],
    ["paid_on","জমার তারিখ","date",true],["verify_status","যাচাইয়ের অবস্থা","select",true,["valid","invalid","pending"]],
    ["used_in_application_no","সংশ্লিষ্ট আবেদন নম্বর (যদি থাকে)","text",false]
  ]},
  nid_persons: { title: "NID / ব্যক্তির তথ্য", fields: [
    ["nid_no_norm","NID নম্বর (১০–১৭ digit)","text",true],["name_bn","পূর্ণ নাম","text",true],
    ["father_name","পিতার নাম","text",true],["mother_name","মাতার নাম","text",true],
    ["dob","জন্মতারিখ","date",true],["address","সম্পূর্ণ ঠিকানা","text",true],
    ["gender","লিঙ্গ","select",false,["male","female","other"]],["occupation","পেশা","text",false]
  ]},
  warish_certs: { title: "ওয়ারিশ সনদ", fields: [
    ["cert_no","ওয়ারিশ সনদ নম্বর","text",true],["cert_date","সনদ প্রদানের তারিখ","date",true],
    ["deceased_name","মৃত ব্যক্তির নাম","text",true],["deceased_father_name","মৃত ব্যক্তির পিতার নাম","text",false],
    ["issuing_authority","ইস্যুকারী কর্তৃপক্ষ","text",true]
  ]},
  name_attestations: { title: "প্রত্যয়ন / Name Attestation", fields: [
    ["attestation_no","প্রত্যয়ন নম্বর","text",true],["person_id","ব্যক্তির Database UUID","text",true],
    ["issued_by","ইস্যুকারী কর্তৃপক্ষ","text",true],["issue_date","ইস্যুর তারিখ","date",true],
    ["name_variant_a","নামের বিকল্প ১","text",false],["name_variant_b","নামের বিকল্প ২","text",false],["note","নোট","text",false]
  ]}
};

export default function ManualDataEntry() {
  const [table,setTable]=useState("echallans"), [values,setValues]=useState({}), [busy,setBusy]=useState(false), [message,setMessage]=useState(""), [error,setError]=useState("");
  const current=forms[table];
  function changeTable(next){setTable(next);setValues({});setMessage("");setError("");}
  async function submit(e){
    e.preventDefault();setBusy(true);setError("");setMessage("");
    const record={};
    current.fields.forEach(([key,,type])=>{const v=values[key];if(v!==undefined&&v!=="") record[key]=type==="number"?Number(v):v;});
    if(table==="nid_persons"){
      const nid=String(record.nid_no||"").replace(/\D/g,"");
      if(!/^\d{10,17}$/.test(nid)){setError("NID নম্বর ১০ থেকে ১৭ digit হতে হবে।");setBusy(false);return;}
      record.nid_no_norm=nid;
    }
    try{
      const res=await fetch("/api/data-entry",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({table,record})});
      const data=await res.json();
      if(!res.ok) setError(data.error||"তথ্য যোগ করা যায়নি।");
      else {setMessage(data.message||"তথ্য যোগ হয়েছে।");setValues({});}
    }catch{setError("সার্ভারের সঙ্গে যোগাযোগ করা যায়নি।");}
    setBusy(false);
  }
  return <main className="mx-auto max-w-4xl space-y-6 p-4 sm:p-8">
    <header className="rounded-2xl bg-slate-950 p-6 text-white"><p className="text-xs font-bold tracking-widest text-cyan-300">LDIS · DATA ENTRY</p><h1 className="mt-2 text-2xl font-bold">Manual Data Entry Operator</h1><p className="mt-2 text-sm text-slate-300">প্রতিটি রেকর্ড হাতে লিখে যোগ করুন। যোগ করা রেকর্ড পরিবর্তন বা মুছে ফেলার সুবিধা নেই।</p></header>
    <section className="rounded-2xl border bg-white p-5 shadow-sm">
      <label className="mb-2 block text-sm font-semibold">কোন ধরনের তথ্য যোগ করবেন?</label>
      <select className="w-full rounded-lg border p-3" value={table} onChange={e=>changeTable(e.target.value)}>{Object.entries(forms).map(([key,f])=><option key={key} value={key}>{f.title}</option>)}</select>
      {message&&<p role="status" className="mt-4 rounded-lg bg-green-50 p-3 text-green-800">{message}</p>}
      {error&&<p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-red-800">{error}</p>}
      <form onSubmit={submit} className="mt-5 grid gap-4 sm:grid-cols-2">
        {current.fields.map(([key,label,type,required,options])=><div key={key}>
          <label className="mb-1 block text-sm font-medium">{label}{required?" *":""}</label>
          {type==="select"?<select required={required} value={values[key]||""} onChange={e=>setValues(v=>({...v,[key]:e.target.value}))} className="w-full rounded-lg border p-3"><option value="">নির্বাচন করুন</option>{options.map(o=><option key={o} value={o}>{o}</option>)}</select>:
          <input required={required} type={type} min={type==="number"?"0.01":undefined} step={type==="number"?"0.01":undefined} value={values[key]||""} onChange={e=>setValues(v=>({...v,[key]:e.target.value}))} className="w-full rounded-lg border p-3" /> }
        </div>)}
        <div className="sm:col-span-2"><button disabled={busy} className="rounded-lg bg-slate-900 px-6 py-3 font-semibold text-white disabled:opacity-50">{busy?"যোগ হচ্ছে…":"ডাটাবেজে যোগ করুন"}</button></div>
      </form>
    </section>
    <p className="text-xs leading-5 text-slate-500">Duplicate check database-এর unique identifier অনুযায়ী হবে। NID, challan ও certificate number আগে থেকেই থাকলে insert বাতিল হবে। প্রয়োজনীয় schema অনুযায়ী Migration 15 চালু থাকতে হবে।</p>
  </main>;
}
