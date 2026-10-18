"use client";
import { useState } from "react";
import Link from "next/link";
import { Alert, Button, Field, Select } from "@/components/ui";
import { LAST_STEP, STEPS } from "@/lib/applications/steps";

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

function localToday() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

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

  return (
    <div className="ldis-wizard ldis-wizard-preflight">
      <div className="ldis-wizard-layout ldis-wizard-preflight-layout">
        <aside className="ldis-wizard-rail" aria-label="নিবন্ধনের ধাপ">
          <div className="ldis-wizard-rail-head">
            <span className="ldis-wizard-eyebrow">LDIS · APPLICATION</span>
            <h2>নিবন্ধনের ধাপ</h2>
            <p>দলিলের প্রকৃতি ও তারিখ সংরক্ষণের পর বাকি ধাপগুলো চালু হবে।</p>
            <div className="ldis-wizard-rail-progress">
              <div className="ldis-wizard-progress-ring" style={{ "--ldis-progress": "0%" }}>
                <div><strong>0</strong><span>/{LAST_STEP}</span></div>
              </div>
              <div><strong>শুরু হয়নি</strong><span>প্রাথমিক তথ্য বাকি</span></div>
            </div>
          </div>
          <nav className="ldis-wizard-step-nav" aria-label="আবেদনের ধাপসমূহ">
            <ol className="ldis-wizard-step-list">
              {STEPS.map((item) => (
                <li key={item.n}>
                  <button type="button" className="ldis-wizard-step is-locked" disabled>
                    <span className="ldis-wizard-step-index">{String(item.n).padStart(2, "0")}</span>
                    <span className="ldis-wizard-step-copy"><strong>{item.bn}</strong><small>{item.en}</small></span>
                    <span className="ldis-wizard-step-chevron" aria-hidden="true">›</span>
                  </button>
                </li>
              ))}
            </ol>
          </nav>
          <div className="ldis-wizard-rail-foot">
            <span className="ldis-wizard-foot-icon" aria-hidden="true">i</span>
            <p>প্রতিটি ধাপে তথ্য যাচাই ও সংরক্ষণ করুন। পরে <Link href="/dashboard/applications">আমার আবেদনসমূহ</Link> থেকে আবেদন চালিয়ে নিতে পারবেন।</p>
          </div>
        </aside>

        <main className="ldis-wizard-main">
          <div className="ldis-wizard-appbar">
            <div className="ldis-wizard-app-reference">
              <span className="ldis-wizard-app-icon" aria-hidden="true">▤</span>
              <div><span>আবেদন নম্বর</span><strong>{applicationNo}</strong></div>
            </div>
            <div className="ldis-wizard-app-status"><span className="ldis-wizard-preflight-badge">প্রাথমিক তথ্য</span></div>
            <div className="ldis-wizard-app-progress">
              <div><span>শুরুর ধাপ</span><strong>দলিলের প্রকৃতি ও তারিখ</strong></div>
              <div className="ldis-wizard-progress-track"><span style={{ width: "8%" }} /></div>
            </div>
          </div>

          <section className="ldis-wizard-form-card" aria-labelledby="deed-nature-title">
            <header className="ldis-wizard-form-heading">
              <span className="ldis-wizard-form-step-icon">✦</span>
              <div className="min-w-0 flex-1">
                <span className="ldis-wizard-eyebrow">START HERE · PREPARATION</span>
                <h2 id="deed-nature-title">দলিলের প্রকৃতি নির্বাচন করুন</h2>
                <p>দাতা-গ্রহীতার তথ্য দেওয়ার আগে দলিলের ধরন ও তারিখ নির্ধারণ করুন <span aria-hidden="true">·</span> Deed type &amp; date</p>
              </div>
            </header>
            <div className="ldis-wizard-step-content">
              <form onSubmit={submit} className="space-y-5">
                <div className="grid gap-5 md:grid-cols-2">
                  <Field label="দলিলের প্রকৃতি · Deed nature" htmlFor="deed-nature" hint="নির্বাচিত প্রকৃতি আবেদন ও নিবন্ধন-ডেমো রেকর্ডে সংরক্ষিত হবে।">
                    <Select id="deed-nature" value={nature} onChange={(e) => setNature(e.target.value)} required>
                      <option value="">— দলিলের প্রকৃতি নির্বাচন করুন —</option>
                      {DEED_NATURES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </Select>
                  </Field>
                  <Field label="দলিলের তারিখ · Deed date" htmlFor="deed-date" hint="দলিলের তারিখ ভবিষ্যতের হতে পারবে না।">
                    <input id="deed-date" type="date" value={deedDate} max={localToday()} onChange={(e) => setDeedDate(e.target.value)} required className="w-full rounded-md border border-slate-300 px-3 py-2" />
                  </Field>
                </div>
                {error && <Alert tone="error">{error}</Alert>}
                <Alert tone="info">এটি LDIS-এর demo workflow। নির্বাচিত প্রকৃতি সরকারি দলিল নিবন্ধন বা আইনি অনুমোদনের বিকল্প নয়।</Alert>
                <div className="ldis-wizard-preflight-actions">
                  <span>পরের ধাপে দাতা ও গ্রহীতার পরিচয় যাচাই করা হবে।</span>
                  <Button type="submit" disabled={busy || !nature || !deedDate}>{busy ? "সংরক্ষণ হচ্ছে…" : "প্রকৃতি সংরক্ষণ করে পরবর্তী ধাপে যান →"}</Button>
                </div>
              </form>
            </div>
          </section>
        </main>

        <aside className="ldis-wizard-summary" aria-label="নোটিশ ও নির্দেশনা">
          <section className="ldis-wizard-summary-card">
            <div className="ldis-wizard-summary-title"><span>i</span><h3>শুরু করার আগে মনে রাখুন</h3></div>
            <ul className="ldis-wizard-tips">
              <li>দলিলের প্রকৃতি মূল দলিলের সঙ্গে মিলিয়ে নির্বাচন করুন</li>
              <li>দলিলের তারিখ সঠিকভাবে দিন; ভবিষ্যতের তারিখ গ্রহণ করা হবে না</li>
              <li>পরবর্তী ধাপে দাতা ও গ্রহীতার পরিচয় তথ্য লাগবে</li>
              <li>প্রয়োজনীয় জমির রেকর্ড ও কাগজপত্র প্রস্তুত রাখুন</li>
            </ul>
          </section>
          <section className="ldis-wizard-summary-card ldis-wizard-gate-notice">
            <div className="ldis-wizard-summary-title"><span>!</span><h3>গুরুত্বপূর্ণ নোটিশ</h3></div>
            <p>এই সিস্টেমটি পরীক্ষামূলক ডেমো। এখানে দেখানো রেফারেন্স তথ্য সরকারি যাচাই, নিবন্ধন বা আইনগত অনুমোদনের বিকল্প নয়।</p>
          </section>
          <Link href="/dashboard/applications" className="ldis-wizard-help-card">
            <span className="ldis-wizard-help-icon">↗</span><span><strong>আবেদন তালিকা</strong><small>আগের আবেদন ও অগ্রগতি দেখুন</small></span><b aria-hidden="true">›</b>
          </Link>
        </aside>
      </div>
    </div>
  );
}
