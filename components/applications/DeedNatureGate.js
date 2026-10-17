"use client";
import { useState } from "react";
import { Alert, Button, Card, Field, Select } from "@/components/ui";

export const DEED_NATURES = [
  ["saf_kabala", "সাফ-কবলা দলিল"],
  ["heba_declaration", "হেবা ঘোষণাপত্র / হেবা দলিল"],
  ["gift_deed", "দানপত্র দলিল"],
  ["partition_deed", "বণ্টননামা দলিল"],
  ["exchange_deed", "বিনিময় দলিল"],
  ["mortgage_deed", "বন্ধক দলিল"],
  ["sale_agreement", "বায়নাপত্র / বিক্রয় চুক্তি"],
  ["release_deed", "দাবি/স্বত্ব ত্যাগ দলিল"],
  ["will_deed", "অছিয়তনামা"],
  ["other", "অন্যান্য"],
];

function localToday() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; }

export default function DeedNatureGate({ applicationNo, onSave, busy }) {
  const [nature, setNature] = useState("");
  const [deedDate, setDeedDate] = useState(localToday);
  const [error, setError] = useState("");
  async function submit(e) {
    e.preventDefault();
    if (!DEED_NATURES.some(([value]) => value === nature)) {
      setError("নতুন দলিলের প্রকৃতি নির্বাচন করুন।");
      return;
    }
    setError("");
    const result = await onSave(nature, deedDate);
    if (result?.error) setError(result.error);
  }
  return <div className="mx-auto max-w-2xl space-y-4">
    <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm">আবেদন নম্বর: <span className="font-mono font-semibold">{applicationNo}</span></div>
    <Card title="প্রথম ধাপ · দলিলের প্রকৃতি নির্বাচন করুন" description="দাতা-গ্রহীতা, জমির তফসিল বা অন্য কোনো তথ্য দেওয়ার আগে দলিলের প্রকৃতি নির্বাচন করতে হবে।">
      <form onSubmit={submit} className="space-y-4">
        <Field label="দলিলের প্রকৃতি · Deed nature" htmlFor="deed-nature" hint="এই প্রকৃতি আবেদন ও নিবন্ধন-ডেমো রেকর্ডে সংরক্ষণ করা হবে।">
          <Select id="deed-nature" value={nature} onChange={(e) => setNature(e.target.value)} required>
            <option value="">— দলিলের প্রকৃতি নির্বাচন করুন —</option>
            {DEED_NATURES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </Select>
        </Field>
        <Field label="দলিলের তারিখ · Deed date" htmlFor="deed-date" hint="দলিলের তারিখ ভবিষ্যতের হতে পারবে না।">
          <input id="deed-date" type="date" value={deedDate} max={localToday()} onChange={(e) => setDeedDate(e.target.value)} required className="w-full rounded-md border border-slate-300 px-3 py-2" />
        </Field>
        {error && <Alert tone="error">{error}</Alert>}
        <Alert tone="info">এটি LDIS-এর demo workflow। নির্বাচিত প্রকৃতি সরকারি দলিল নিবন্ধন বা আইনি অনুমোদনের বিকল্প নয়।</Alert>
        <Button type="submit" disabled={busy || !nature || !deedDate}>{busy ? "সংরক্ষণ হচ্ছে…" : "প্রকৃতি সংরক্ষণ করে পরবর্তী ধাপে যান →"}</Button>
      </form>
    </Card>
  </div>;
}
