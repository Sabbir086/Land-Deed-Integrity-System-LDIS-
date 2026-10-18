"use client";
import { useState } from "react";
import LocationPicker from "@/components/verify/LocationPicker";

const forms = {
  echallans: { title: "E-Challan তথ্য", fields: [
    ["amount", "জমার পরিমাণ (টাকা)", "number", true],
    ["fee_type", "কোন খাতে জমা", "select", true, ["stamp", "registration", "source_tax", "other"]],
    ["paid_on", "জমার তারিখ", "date", true],
    ["verify_status", "যাচাইয়ের অবস্থা", "select", true, ["verified", "invalid", "pending"]],
    ["used_in_application_no", "সংশ্লিষ্ট আবেদন নম্বর (যদি থাকে)", "text", false]
  ]},
  nid_persons: { title: "NID / ব্যক্তির তথ্য", fields: [
    ["nid_no", "NID নম্বর (১০–১৭ digit)", "text", true], ["name_bn", "পূর্ণ নাম", "text", true],
    ["father_name", "পিতার নাম", "text", true], ["mother_name", "মাতার নাম", "text", true],
    ["dob", "জন্মতারিখ", "date", true], ["address", "সম্পূর্ণ ঠিকানা", "text", true],
    ["gender", "লিঙ্গ", "select", false, ["male", "female", "other"]], ["occupation", "পেশা", "text", false]
  ]},
  warish_certs: { title: "ওয়ারিশ সনদ", fields: [
    ["cert_date", "সনদ প্রদানের তারিখ", "date", true],
    ["deceased_name", "মৃত ব্যক্তির নাম", "text", true], ["deceased_father_name", "মৃত ব্যক্তির পিতার নাম", "text", false],
    ["issuing_authority", "ইস্যুকারী কর্তৃপক্ষ", "text", true]
  ]},
  name_attestations: { title: "প্রত্যয়ন / Name Attestation", fields: [
    ["person_name", "ব্যক্তির নাম (NID ডাটাবেজে থাকা নাম)", "text", true],
    ["issued_by", "ইস্যুকারী কর্তৃপক্ষ", "text", true], ["issue_date", "ইস্যুর তারিখ", "date", true],
    ["name_variant_a", "নামের বিকল্প ১", "text", false], ["name_variant_b", "নামের বিকল্প ২", "text", false], ["note", "নোট", "text", false]
  ]},
  khatians: { title: "পর্চা / খতিয়ান ও দাগ", fields: [
    ["khatian_type", "খতিয়ানের ধরন", "select", true, ["BRS", "NAMJARI"]],
    ["khatian_no", "খতিয়ান নম্বর", "text", true]
  ]}
};

const emptyOwner = () => ({ owner_name: "", father_name: "", share: "1" });
const emptyHeir = () => ({ person_name: "", relation: "", share: "" });
const emptyDag = () => ({ dag_no: "", land_class: "", area: "" });

export default function ManualDataEntry() {
  const [table, setTable] = useState("echallans");
  const [values, setValues] = useState({});
  const [owners, setOwners] = useState([emptyOwner()]);
  const [heirs, setHeirs] = useState([emptyHeir()]);
  const [dags, setDags] = useState([emptyDag()]);
  const [khatianLocation, setKhatianLocation] = useState({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [generatedIdentifier, setGeneratedIdentifier] = useState("");
  const current = forms[table];

  function changeTable(next) {
    setTable(next);
    setValues({});
    setOwners([emptyOwner()]);
    setHeirs([emptyHeir()]);
    setDags([emptyDag()]);
    setKhatianLocation({});
    setMessage("");
    setError("");
    setGeneratedIdentifier("");
  }

  function updateRow(setter, rows, index, key, value) {
    setter(rows.map((row, i) => (i === index ? { ...row, [key]: value } : row)));
  }

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    setGeneratedIdentifier("");

    const record = {};
    current.fields.forEach(([key, , type]) => {
      const value = values[key];
      if (value !== undefined && value !== "") record[key] = type === "number" ? Number(value) : value;
    });

    if (table === "nid_persons") {
      const nid = String(record.nid_no || "").replace(/[^0-9০-৯]/g, "");
      if (!/^[0-9০-৯]{10,17}$/.test(nid)) {
        setError("NID নম্বর ১০ থেকে ১৭ digit হতে হবে।");
        setBusy(false);
        return;
      }
      record.nid_no = nid;
    }

    if (table === "warish_certs") {
      const cleanHeirs = heirs.filter((heir) => heir.person_name.trim() && heir.relation.trim() && heir.share !== "");
      if (!cleanHeirs.length) {
        setError("অন্তত একজন ওয়ারিশের নাম, সম্পর্ক ও অংশ দিন।");
        setBusy(false);
        return;
      }
      if (cleanHeirs.some((heir) => !Number.isFinite(Number(heir.share)) || Number(heir.share) <= 0 || Number(heir.share) > 1)) {
        setError("প্রত্যেক ওয়ারিশের অংশ ০-এর বেশি এবং ১ বা তার কম হতে হবে।");
        setBusy(false);
        return;
      }
      record.heirs = cleanHeirs.map((heir) => ({
        person_name: heir.person_name.trim(),
        relation: heir.relation.trim(),
        share: Number(heir.share)
      }));
    }

    if (table === "name_attestations" && !String(record.person_name || "").trim()) {
      setError("প্রত্যয়নের জন্য ব্যক্তির নাম লিখুন।");
      setBusy(false);
      return;
    }

    if (table === "khatians") {
      if (!khatianLocation.location_id) {
        setError("পর্চার জন্য বিভাগ, জেলা, উপজেলা ও মৌজা নির্বাচন করুন।");
        setBusy(false);
        return;
      }
      const cleanOwners = owners.filter((o) => o.owner_name.trim() && o.share !== "");
      const cleanDags = dags.filter((d) => d.dag_no.trim() && d.land_class.trim() && d.area !== "");
      if (!cleanOwners.length) {
        setError("অন্তত একজন মালিকের নাম ও অংশ লিখুন।");
        setBusy(false);
        return;
      }
      if (!cleanDags.length) {
        setError("অন্তত একটি দাগ নম্বর, জমির শ্রেণি ও পরিমাণ লিখুন।");
        setBusy(false);
        return;
      }
      if (cleanOwners.some((o) => !Number.isFinite(Number(o.share)) || Number(o.share) <= 0 || Number(o.share) > 1)) {
        setError("প্রত্যেক মালিকের অংশ ০-এর বেশি এবং ১ বা তার কম হতে হবে (যেমন: ০.৫ বা ১)।");
        setBusy(false);
        return;
      }
      if (cleanDags.some((d) => !Number.isFinite(Number(d.area)) || Number(d.area) <= 0)) {
        setError("প্রত্যেক দাগের জমির পরিমাণ শূন্যের বেশি হতে হবে।");
        setBusy(false);
        return;
      }
      record.location_id = khatianLocation.location_id;
      record.owners = cleanOwners.map((o) => ({
        owner_name: o.owner_name.trim(),
        father_name: o.father_name.trim() || null,
        share: Number(o.share)
      }));
      record.dags = cleanDags.map((d) => ({
        dag_no: d.dag_no.trim(),
        land_class: d.land_class.trim(),
        area: Number(d.area)
      }));
    }

    try {
      const response = await fetch("/api/data-entry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ table, record })
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || "তথ্য যোগ করা যায়নি।");
      } else {
        setMessage(data.message || "তথ্য যোগ হয়েছে।");
        setGeneratedIdentifier(data.data?.identifier || "");
        setValues({});
        if (table === "khatians") {
          setOwners([emptyOwner()]);
          setDags([emptyDag()]);
        }
        if (table === "warish_certs") setHeirs([emptyHeir()]);
      }
    } catch {
      setError("সার্ভারের সঙ্গে যোগাযোগ করা যায়নি।");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="ldis-role-dashboard ldis-data-entry-dashboard mx-auto max-w-5xl space-y-6 p-4 sm:p-8">
      <header className="rounded-2xl bg-slate-950 p-6 text-white">
        <p className="text-xs font-bold tracking-widest text-cyan-300">LDIS · DATA ENTRY</p>
        <h1 className="mt-2 text-2xl font-bold">Manual Data Entry Operator</h1>
        <p className="mt-2 text-sm text-slate-300">চালান, NID, ওয়ারিশ সনদ, প্রত্যয়ন ও পর্চার তথ্য যোগ করুন। রেকর্ড যোগ করার পর এই ফর্ম থেকে পরিবর্তন বা মুছে ফেলা যাবে না।</p>
      </header>

      <section className="rounded-2xl border bg-white p-5 shadow-sm">
        <label className="mb-2 block text-sm font-semibold" htmlFor="data-entry-table">কোন ধরনের তথ্য যোগ করবেন?</label>
        <select id="data-entry-table" className="w-full rounded-lg border p-3" value={table} onChange={(e) => changeTable(e.target.value)}>
          {Object.entries(forms).map(([key, form]) => <option key={key} value={key}>{form.title}</option>)}
        </select>

        {message && <p role="status" className="mt-4 rounded-lg bg-green-50 p-3 text-green-800">
          {message}{generatedIdentifier && <span className="mt-1 block font-mono font-bold">স্বয়ংক্রিয়ভাবে তৈরি নম্বর: {generatedIdentifier}</span>}
        </p>}
        {error && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-red-800">{error}</p>}

        <form onSubmit={submit} className="mt-5 grid gap-4 sm:grid-cols-2">
          {table === "echallans" && <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm sm:col-span-2">
            চালান নম্বর লিখবেন না। Save করার সময় database স্বয়ংক্রিয়ভাবে পরবর্তী <span className="font-mono font-semibold">2627-10001</span> ফরম্যাটের নম্বর তৈরি করবে।
          </div>}
          {table === "warish_certs" && <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm sm:col-span-2">
            ওয়ারিশ সনদ নম্বর স্বয়ংক্রিয়ভাবে <span className="font-mono font-semibold">WAR-101</span> থেকে ধারাবাহিকভাবে তৈরি হবে। নম্বর লিখতে হবে না।
          </div>}
          {table === "name_attestations" && <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm sm:col-span-2">
            প্রত্যয়ন নম্বর স্বয়ংক্রিয়ভাবে <span className="font-mono font-semibold">ATT-101</span> থেকে ধারাবাহিকভাবে তৈরি হবে। UUID নয়, NID ডাটাবেজে থাকা ব্যক্তির নাম দিন।
          </div>}
          {table === "khatians" && <>
            <div className="sm:col-span-2">
              <p className="mb-3 text-sm font-semibold">পর্চার অবস্থান</p>
              <LocationPicker apiPath="/api/data-entry/options" onChange={setKhatianLocation} onError={setError} />
            </div>
          </>}

          {current.fields.map(([key, label, type, required, options]) => <div key={key}>
            <label className="mb-1 block text-sm font-medium" htmlFor={`field-${key}`}>{label}{required ? " *" : ""}</label>
            {type === "select" ? (
              <select id={`field-${key}`} required={required} value={values[key] || ""} onChange={(e) => setValues((previous) => ({ ...previous, [key]: e.target.value }))} className="w-full rounded-lg border p-3">
                <option value="">নির্বাচন করুন</option>
                {options.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            ) : (
              <input id={`field-${key}`} required={required} type={type} inputMode={key === "nid_no" || key === "khatian_no" ? "numeric" : undefined}
                min={type === "number" ? "0.01" : undefined} step={type === "number" ? "0.01" : undefined}
                value={values[key] || ""} onChange={(e) => setValues((previous) => ({ ...previous, [key]: e.target.value }))}
                className="w-full rounded-lg border p-3" />
            )}
          </div>)}

          {table === "warish_certs" && <div className="sm:col-span-2 rounded-xl border p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-semibold">ওয়ারিশদের তথ্য</h2>
              <button type="button" onClick={() => setHeirs((previous) => [...previous, emptyHeir()])} className="rounded-lg border px-3 py-2 text-sm font-semibold">+ ওয়ারিশ যোগ করুন</button>
            </div>
            <p className="mb-3 text-xs text-slate-500">প্রত্যেক ওয়ারিশের নাম আগে NID / ব্যক্তির তথ্য অংশে যোগ করা থাকতে হবে।</p>
            <div className="space-y-3">
              {heirs.map((heir, index) => <div key={index} className="grid gap-3 rounded-lg bg-slate-50 p-3 sm:grid-cols-3">
                <div><label className="mb-1 block text-sm">ওয়ারিশের নাম *</label><input required value={heir.person_name} onChange={(e) => updateRow(setHeirs, heirs, index, "person_name", e.target.value)} className="w-full rounded-lg border p-2.5" /></div>
                <div><label className="mb-1 block text-sm">মৃত ব্যক্তির সঙ্গে সম্পর্ক *</label><input required value={heir.relation} onChange={(e) => updateRow(setHeirs, heirs, index, "relation", e.target.value)} placeholder="যেমন: পুত্র, কন্যা, স্ত্রী" className="w-full rounded-lg border p-2.5" /></div>
                <div><label className="mb-1 block text-sm">অংশ (০–১) *</label><div className="flex gap-2"><input required type="number" min="0.0001" max="1" step="0.0001" value={heir.share} onChange={(e) => updateRow(setHeirs, heirs, index, "share", e.target.value)} className="w-full rounded-lg border p-2.5" />{heirs.length > 1 && <button type="button" onClick={() => setHeirs((previous) => previous.filter((_, i) => i !== index))} aria-label="ওয়ারিশ বাদ দিন" className="rounded-lg border px-3 text-red-700">×</button>}</div></div>
              </div>)}
            </div>
            <p className="mt-2 text-xs text-slate-500">সব ওয়ারিশের অংশের যোগফল সাধারণত ১ হওয়া উচিত।</p>
          </div>}

          {table === "khatians" && <>
            <div className="sm:col-span-2 rounded-xl border p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-semibold">পর্চার মালিকের তথ্য</h2>
                <button type="button" onClick={() => setOwners((previous) => [...previous, emptyOwner()])} className="rounded-lg border px-3 py-2 text-sm font-semibold">+ মালিক যোগ করুন</button>
              </div>
              <div className="space-y-3">
                {owners.map((owner, index) => <div key={index} className="grid gap-3 rounded-lg bg-slate-50 p-3 sm:grid-cols-3">
                  <div><label className="mb-1 block text-sm">মালিকের নাম *</label><input required value={owner.owner_name} onChange={(e) => updateRow(setOwners, owners, index, "owner_name", e.target.value)} className="w-full rounded-lg border p-2.5" /></div>
                  <div><label className="mb-1 block text-sm">পিতা/স্বামীর নাম</label><input value={owner.father_name} onChange={(e) => updateRow(setOwners, owners, index, "father_name", e.target.value)} className="w-full rounded-lg border p-2.5" /></div>
                  <div><label className="mb-1 block text-sm">মালিকের অংশ (যেমন ০.৫ বা ১) *</label><div className="flex gap-2"><input required type="number" min="0.0001" max="1" step="0.0001" value={owner.share} onChange={(e) => updateRow(setOwners, owners, index, "share", e.target.value)} className="w-full rounded-lg border p-2.5" />{owners.length > 1 && <button type="button" onClick={() => setOwners((previous) => previous.filter((_, i) => i !== index))} aria-label="মালিক বাদ দিন" className="rounded-lg border px-3 text-red-700">×</button>}</div></div>
                </div>)}
              </div>
              <p className="mt-2 text-xs text-slate-500">সব মালিকের অংশের যোগফল সাধারণত ১ হওয়া উচিত।</p>
            </div>

            <div className="sm:col-span-2 rounded-xl border p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-semibold">দাগের তথ্য</h2>
                <button type="button" onClick={() => setDags((previous) => [...previous, emptyDag()])} className="rounded-lg border px-3 py-2 text-sm font-semibold">+ দাগ যোগ করুন</button>
              </div>
              <div className="space-y-3">
                {dags.map((dag, index) => <div key={index} className="grid gap-3 rounded-lg bg-slate-50 p-3 sm:grid-cols-3">
                  <div><label className="mb-1 block text-sm">দাগ নম্বর *</label><input required value={dag.dag_no} onChange={(e) => updateRow(setDags, dags, index, "dag_no", e.target.value)} className="w-full rounded-lg border p-2.5" /></div>
                  <div><label className="mb-1 block text-sm">জমির শ্রেণি *</label><input required value={dag.land_class} onChange={(e) => updateRow(setDags, dags, index, "land_class", e.target.value)} placeholder="যেমন: নাল, ভিটা, পুকুর" className="w-full rounded-lg border p-2.5" /></div>
                  <div><label className="mb-1 block text-sm">জমির পরিমাণ (শতক) *</label><div className="flex gap-2"><input required type="number" min="0.0001" step="0.0001" value={dag.area} onChange={(e) => updateRow(setDags, dags, index, "area", e.target.value)} className="w-full rounded-lg border p-2.5" />{dags.length > 1 && <button type="button" onClick={() => setDags((previous) => previous.filter((_, i) => i !== index))} aria-label="দাগ বাদ দিন" className="rounded-lg border px-3 text-red-700">×</button>}</div></div>
                </div>)}
              </div>
            </div>
          </>}

          <div className="sm:col-span-2"><button disabled={busy} className="rounded-lg bg-slate-900 px-6 py-3 font-semibold text-white disabled:opacity-50">{busy ? "যোগ হচ্ছে…" : "ডাটাবেজে যোগ করুন"}</button></div>
        </form>
      </section>
      <p className="text-xs leading-5 text-slate-500">চালান, ওয়ারিশ সনদ ও প্রত্যয়ন নম্বর database থেকে পরপর স্বয়ংক্রিয়ভাবে তৈরি হবে। NID, একই মৌজা/ধরন/খতিয়ান নম্বর এবং অন্যান্য unique identifier-এর duplicate check হবে। নতুন SQL function ও পর্চা ইনসার্টের জন্য Migration 25 চালাতে হবে।</p>
    </main>
  );
}
