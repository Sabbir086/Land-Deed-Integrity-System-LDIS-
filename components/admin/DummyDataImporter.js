"use client";

import { useState } from "react";
import Link from "next/link";

const datasets = [
  { value: "nid_persons", label: "NID / Person records" },
  { value: "locations", label: "Division / District / Upazila / Mouza" },
  { value: "khatians", label: "Porcha / Khatians" },
  { value: "khatian_owners", label: "Porcha owners" },
  { value: "khatian_dags", label: "Dag / Land area" },
  { value: "khas_govt", label: "Khas / Government land records" },
  { value: "warish_certs", label: "Warish certificates" },
  { value: "warish_heirs", label: "Warish heirs" },
  { value: "name_attestations", label: "Prottoyon / Name attestations" },
  { value: "echallans", label: "E-Challan records" },
  { value: "deeds", label: "Deed / Baya deed records" },
];

export default function DummyDataImporter() {
  const [table, setTable] = useState("nid_persons");
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);

  async function upload(e) {
    e.preventDefault();
    if (!file) return;

    setBusy(true);
    setMessage(null);
    try {
      const parsed = JSON.parse(await file.text());
      const rows = Array.isArray(parsed) ? parsed : [parsed];
      if (!rows.length || rows.length > 500 || rows.some((row) => !row || typeof row !== "object" || Array.isArray(row))) {
        throw new Error("JSON-এ ১ থেকে ৫০০টি object থাকতে হবে।");
      }

      const response = await fetch("/api/admin/dummy-data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ table, rows }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Upload failed.");

      setMessage({ ok: true, text: `${result.inserted}টি রেকর্ড যোগ হয়েছে।` });
      setFile(null);
      e.target.reset();
    } catch (err) {
      setMessage({ ok: false, text: err.message || "ফাইল আপলোড করা যায়নি।" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-4xl space-y-6 p-5 sm:p-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-amber-700">LDIS · SUPER ADMIN</p>
          <h1 className="mt-2 text-2xl font-bold">Add Dummy Data</h1>
          <p className="mt-1 text-sm text-slate-500">পরীক্ষামূলক রেকর্ড আপলোড ও যাচাই করুন।</p>
        </div>
        <Link href="/admin" className="rounded-lg border px-4 py-2 text-sm font-semibold">← Admin Dashboard</Link>
      </header>

      <section className="rounded-2xl border bg-white p-5 shadow-sm">
        <form onSubmit={upload} className="space-y-5">
          <div>
            <label htmlFor="dataset" className="mb-2 block text-sm font-semibold">Dataset / ডেটার ধরন</label>
            <select id="dataset" className="w-full rounded-lg border p-3" value={table} onChange={(e) => setTable(e.target.value)}>
              {datasets.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="json-file" className="mb-2 block text-sm font-semibold">JSON file</label>
            <input id="json-file" type="file" accept=".json,application/json" className="w-full rounded-lg border p-3" onChange={(e) => setFile(e.target.files?.[0] || null)} required />
            <p className="mt-2 text-xs text-slate-500">প্রতি ফাইলে সর্বোচ্চ ৫০০টি JSON record। সঠিক field name এবং সম্পর্কিত record ID ব্যবহার করুন।</p>
          </div>
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
            শুধু কাল্পনিক পরীক্ষামূলক তথ্য ব্যবহার করুন। এই অপশন সরাসরি reference database-এ রেকর্ড যোগ করবে। Upload সফল না হলে database-এর field ও relationship যাচাই করুন।
          </div>
          {message && <p role="status" className={`rounded-lg p-3 text-sm ${message.ok ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"}`}>{message.text}</p>}
          <button type="submit" disabled={busy || !file} className="rounded-lg bg-amber-600 px-5 py-3 font-semibold text-white disabled:opacity-50">{busy ? "Uploading..." : "Upload Dummy Data"}</button>
        </form>
      </section>

      <section className="rounded-2xl border bg-white p-5">
        <h2 className="font-bold">JSON format example</h2>
        <pre className="mt-3 overflow-x-auto rounded-lg bg-slate-950 p-4 text-xs text-white">{`[\n  {\n    "name_bn": "কাল্পনিক নাম",\n    "father_name": "কাল্পনিক পিতার নাম",\n    "mother_name": "কাল্পনিক মাতার নাম"\n  }\n]`}</pre>
        <p className="mt-3 text-xs text-slate-500">এটি শুধু format বোঝানোর উদাহরণ। প্রতিটি টেবিলের required fields আলাদা; প্রকৃত schema অনুযায়ী JSON তৈরি করুন।</p>
      </section>
    </main>
  );
}
