"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

const ITEMS = [
  { id: 1, label: "আবেদন নম্বর, আবেদনকারীর তথ্য ও দলিলের প্রকৃতি সঠিক" },
  { id: 2, label: "দাতা ও গ্রহীতার নাম/পরিচয়-তথ্য সঠিক" },
  { id: 3, label: "দাতা/গ্রহীতার NID ও জন্মতারিখ সঠিক" },
  { id: 4, label: "খতিয়ান ও মালিকানার ভিত্তি যাচাই সঠিক" },
  { id: 5, label: "বায়া/পূর্ববর্তী দলিলের ধারাবাহিকতা সঠিক" },
  { id: 6, label: "দাগ নম্বর, জমির পরিমাণ ও অবশিষ্ট জমি সঠিক" },
  { id: 7, label: "জমির শ্রেণি ও অবস্থান সঠিক" },
  { id: 8, label: "সরকারি স্বার্থ/নিষেধাজ্ঞার তথ্য পর্যালোচনা করা হয়েছে" },
  { id: 9, label: "প্রয়োজনীয় সহায়ক নথি পর্যালোচনা করা হয়েছে" },
  { id: 10, label: "ফি-এর হিসাব সঠিক" },
  { id: 11, label: "চালান নম্বর, পরিমাণ ও পেমেন্ট যাচাই সঠিক" },
  { id: 12, label: "অ্যাপয়েন্টমেন্ট, বায়োমেট্রিক ও নিবন্ধন-সংক্রান্ত তথ্য সঠিক" },
];

const ChecklistContext = createContext(null);
const sameRecord = (a, b) => ITEMS.every((item) => (a?.[item.id] || "") === (b?.[item.id] || ""));
const sameReasons = (a, b) => ITEMS.every((item) => (a?.[item.id] || "") === (b?.[item.id] || ""));

export function useRegistrarChecklist() {
  return useContext(ChecklistContext) || { ready: false, loading: true, readOnly: true };
}

export function RegistrarChecklistProvider({ applicationId, readOnly = false, canEdit = true, children }) {
  const [decisions, setDecisions] = useState({});
  const [reasons, setReasons] = useState({});
  const [savedDecisions, setSavedDecisions] = useState({});
  const [savedReasons, setSavedReasons] = useState({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let live = true;
    (async () => {
      setLoading(true);
      setLoadError("");
      try {
        const r = await fetch(`/api/staff/checklist?application_id=${encodeURIComponent(applicationId)}`, { cache: "no-store" });
        const j = await r.json();
        if (!r.ok) throw new Error(j.error || "চেকলিস্ট লোড করা যায়নি।");
        const nextDecisions = j.data?.decisions || {};
        const nextReasons = j.data?.reasons || {};
        if (live) {
          setDecisions(nextDecisions);
          setReasons(nextReasons);
          setSavedDecisions(nextDecisions);
          setSavedReasons(nextReasons);
        }
      } catch (error) {
        if (live) setLoadError(error.message || "চেকলিস্ট লোড করা যায়নি। সর্বশেষ SQL migration চালানো হয়েছে কি না দেখুন।");
      } finally {
        if (live) setLoading(false);
      }
    })();
    return () => { live = false; };
  }, [applicationId]);

  const allDecided = useMemo(() => ITEMS.every((item) => {
    const decision = decisions[item.id];
    return decision === "correct" || (decision === "incorrect" && (reasons[item.id] || "").trim().length >= 5);
  }), [decisions, reasons]);
  const allCorrect = useMemo(() => ITEMS.every((item) => decisions[item.id] === "correct"), [decisions]);
  const saved = sameRecord(decisions, savedDecisions) && sameReasons(reasons, savedReasons);
  const editDisabled = readOnly || !canEdit;
  const ready = !editDisabled && !loading && !loadError && allCorrect && saved;

  async function save() {
    if (editDisabled || !allDecided || busy) return;
    setBusy(true);
    setMessage("");
    try {
      const r = await fetch("/api/staff/checklist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          application_id: applicationId,
          items: ITEMS.map((item) => ({
            item_id: item.id,
            decision: decisions[item.id] || "",
            reason: reasons[item.id] || "",
          })),
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "চেকলিস্ট সংরক্ষণ করা যায়নি।");
      const nextDecisions = j.data?.decisions || decisions;
      const nextReasons = j.data?.reasons || reasons;
      setDecisions(nextDecisions);
      setReasons(nextReasons);
      setSavedDecisions(nextDecisions);
      setSavedReasons(nextReasons);
      setMessage("চেকলিস্ট ডাটাবেজে সংরক্ষিত হয়েছে।");
    } catch (error) {
      setMessage(error.message || "চেকলিস্ট সংরক্ষণ করা যায়নি।");
    } finally {
      setBusy(false);
    }
  }

  const value = {
    items: ITEMS, decisions, reasons, setDecisions, setReasons,
    loading, busy, message, loadError, readOnly, canEdit, editDisabled, allDecided, allCorrect, saved, ready, save,
  };
  return <ChecklistContext.Provider value={value}>{children}</ChecklistContext.Provider>;
}

export function RegistrarChecklistItem({ itemId }) {
  const ctx = useRegistrarChecklist();
  const item = ctx.items?.find((x) => x.id === itemId);
  if (!item) return null;
  const decision = ctx.decisions[itemId] || "";
  return (
    <section className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3" aria-label={`চেকলিস্ট ${itemId}`}>
      <div className="text-sm font-semibold text-slate-800">সাব-রেজিস্ট্রারের যাচাই · {itemId}/12</div>
      <div className="mt-1 text-sm">{item.label}</div>
      <div className="mt-2 flex flex-wrap gap-x-5 gap-y-2 text-sm">
        <label className="flex items-center gap-2">
          <input type="radio" name={`registrar-check-${itemId}`} checked={decision === "correct"} disabled={ctx.editDisabled || ctx.loading || ctx.busy} onChange={() => ctx.setDecisions((s) => ({ ...s, [itemId]: "correct" }))} />
          সঠিক
        </label>
        <label className="flex items-center gap-2">
          <input type="radio" name={`registrar-check-${itemId}`} checked={decision === "incorrect"} disabled={ctx.editDisabled || ctx.loading || ctx.busy} onChange={() => ctx.setDecisions((s) => ({ ...s, [itemId]: "incorrect" }))} />
          সঠিক নয়
        </label>
      </div>
      {decision === "incorrect" && (
        <textarea className="mt-2 w-full rounded-md border border-slate-300 bg-white p-2 text-sm" rows={2} disabled={ctx.editDisabled || ctx.busy}
          value={ctx.reasons[itemId] || ""} onChange={(e) => ctx.setReasons((s) => ({ ...s, [itemId]: e.target.value }))}
          placeholder="কোন তথ্যটি ভুল এবং কেন—কমপক্ষে ৫ অক্ষরে লিখুন।" />
      )}
      {ctx.loading && <p className="mt-2 text-xs text-slate-500">আগের সিদ্ধান্ত লোড হচ্ছে…</p>}
      {ctx.readOnly && <p className="mt-2 text-xs text-amber-800">সরকারি স্বার্থের রেকর্ড থাকায় নিবন্ধন-চেকলিস্ট সম্পাদনা বন্ধ। এই আবেদনে শুধু প্রত্যাখ্যান করা যাবে।</p>}
    </section>
  );
}

export function RegistrarChecklistSavePanel() {
  const ctx = useRegistrarChecklist();
  const count = ctx.items?.filter((item) => ctx.decisions[item.id]).length || 0;
  const correctCount = ctx.items?.filter((item) => ctx.decisions[item.id] === "correct").length || 0;
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4">
      <h2 className="text-lg font-semibold">চেকলিস্ট সংরক্ষণ ও নিবন্ধনের প্রস্তুতি</h2>
      <p className="mt-1 text-sm text-slate-600">প্রতিটি অংশের ঠিক নিচে থাকা প্রশ্নের উত্তর দিন। নিবন্ধনের আগে ১২টির সবগুলো “সঠিক” হিসেবে সংরক্ষিত থাকতে হবে। কোনো তথ্য ভুল হলে সংশোধনের অনুরোধ করুন; ভুল তথ্যকে সঠিক হিসেবে চিহ্নিত করবেন না।</p>
      {ctx.loadError && <p role="alert" className="mt-3 rounded bg-red-50 p-3 text-sm text-red-800">{ctx.loadError}</p>}
      {ctx.readOnly ? (
        <p className="mt-3 rounded bg-amber-50 p-3 text-sm text-amber-900">সরকারি স্বার্থের কারণে নিবন্ধন নিষিদ্ধ। চেকলিস্ট সংরক্ষণ ও নিবন্ধন অনুমোদন বন্ধ; কেবল Reject করা যাবে।</p>
      ) : !ctx.canEdit ? (
        <p className="mt-3 rounded bg-slate-50 p-3 text-sm text-slate-700">চেকলিস্ট পূরণের আগে “পর্যালোচনা শুরু” করে আবেদনকে Under review অবস্থায় আনুন।</p>
      ) : (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button type="button" onClick={ctx.save} disabled={ctx.loading || ctx.busy || !ctx.allDecided || Boolean(ctx.loadError)} className="rounded bg-slate-800 px-4 py-2 text-white disabled:opacity-50">
            {ctx.busy ? "সংরক্ষণ হচ্ছে…" : "১২টি যাচাই সংরক্ষণ করুন"}
          </button>
          <span className="text-sm text-slate-600">সিদ্ধান্ত: {count}/12 · সঠিক: {correctCount}/12</span>
          {ctx.saved && ctx.allCorrect && <span className="text-sm font-semibold text-emerald-700">সব ১২টি সঠিকভাবে সংরক্ষিত</span>}
          {!ctx.saved && <span className="text-sm text-amber-700">পরিবর্তন আছে—আবার সংরক্ষণ করুন</span>}
          {ctx.message && <span role="status" className="text-sm text-slate-700">{ctx.message}</span>}
        </div>
      )}
    </section>
  );
}
