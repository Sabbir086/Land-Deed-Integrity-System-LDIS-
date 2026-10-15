"use client";
import { useCallback, useState } from "react";
import Link from "next/link";
import { Alert, Badge, Button } from "@/components/ui";
import Indicators from "@/components/verify/Indicators";
import StatusBadge from "./StatusBadge";
import { appCall } from "./api";
import { STEPS, LAST_STEP, maxReachableStep, stepDone } from "@/lib/applications/steps";
import { sortIndicators } from "@/lib/verify/risk";
import StepParties from "./StepParties"; import StepLand from "./StepLand"; import StepOwnership from "./StepOwnership";
import StepPlots from "./StepPlots"; import StepDetails from "./StepDetails"; import StepFees from "./StepFees";
import StepDocuments from "./StepDocuments"; import StepAppointment from "./StepAppointment"; import StepReview from "./StepReview";

const BODY = { 1: StepParties, 2: StepLand, 3: StepOwnership, 4: StepPlots, 5: StepDetails, 6: StepFees, 7: StepDocuments, 8: StepAppointment, 9: StepReview };

export default function Wizard({ initial }) {
  const [view, setView] = useState(initial);
  const [step, setStep] = useState(Math.min(Math.max(initial.application.current_step || 1, 1), LAST_STEP));
  const [busy, setBusy] = useState(false); const [error, setError] = useState(null);
  const appId = view.application.id;
  const maxStep = maxReachableStep(view);

  const call = useCallback(async (action, body = {}) => {
    setBusy(true); setError(null);
    const r = await appCall(action, { app_id: appId, ...body });
    setBusy(false);
    if (r.error) setError(r.error); else if (r.data?.application) setView(r.data.application);
    return r;
  }, [appId]);

  function go(n) {
    if (n < 1 || n > LAST_STEP || n > maxStep) return;
    setStep(n); setError(null);
    appCall("progress", { app_id: appId, step: n });      // remember the position for "continue later"
    if (typeof window !== "undefined") window.scrollTo({ top: 0 });
  }
  const Body = BODY[step];
  const flags = sortIndicators(view.application.flags || []);
  return (
    <div className="grid gap-6 lg:grid-cols-[16rem,1fr]">
      <aside className="space-y-4">
        <nav aria-label="আবেদনের ধাপ · Application steps"><ol className="flex gap-2 overflow-x-auto pb-2 lg:flex-col lg:overflow-visible">
          {STEPS.map((s) => {
            const done = stepDone(view, s.n); const locked = s.n > maxStep;
            return (
              <li key={s.n} className="shrink-0">
                <button type="button" onClick={() => go(s.n)} disabled={locked} aria-current={step === s.n ? "step" : undefined}
                  className={`flex w-full items-center gap-2 rounded-md border px-3 py-2 text-left text-sm disabled:cursor-not-allowed disabled:opacity-50 ${step === s.n ? "border-brand-600 bg-brand-50 font-semibold" : "border-slate-200 bg-white hover:border-brand-500"}`}>
                  <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs ${done && s.n < LAST_STEP ? "bg-brand-700 text-white" : "bg-slate-200"}`}>{done && s.n < LAST_STEP ? "✓" : s.n}</span>
                  <span>{s.bn}<span className="block text-xs font-normal text-slate-500">{s.en}</span></span>
                </button>
              </li>);
          })}
        </ol></nav>
        <div className="hidden text-xs text-slate-500 lg:block">প্রতিটি ধাপের “সংরক্ষণ” বোতামে তথ্য সংরক্ষিত হয়; পরে <Link className="underline" href="/dashboard/applications">আমার আবেদনসমূহ</Link> থেকে চালিয়ে যেতে পারবেন।</div>
      </aside>
      <div className="min-w-0 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-slate-200 bg-white px-4 py-2 text-sm">
          <span>আবেদন নম্বর: <span className="font-mono font-semibold">{view.application.application_no}</span></span>
          <StatusBadge status={view.application.status} />
        </div>
        {view.application.status === "correction_requested" && (
          <Alert tone="warn" title="সংশোধনের অনুরোধ · Correction requested">{(view.corrections || []).filter((c) => !c.resolved_at).map((c) => <p key={c.id}>{c.message}</p>)}</Alert>)}
        {error && <Alert tone="error">{error}</Alert>}
        <section aria-labelledby="step-title">
          <h2 id="step-title" className="mb-3 text-xl font-semibold">ধাপ {step}: {STEPS[step - 1].bn} <span className="text-sm font-normal text-slate-500">{STEPS[step - 1].en}</span></h2>
          <Body view={view} call={call} busy={busy} go={go} setView={setView} />
        </section>
        <div className="flex flex-wrap justify-between gap-2 border-t border-slate-200 pt-4">
          <Button variant="secondary" onClick={() => go(step - 1)} disabled={step === 1 || busy}>← আগের ধাপ</Button>
          {step < LAST_STEP && <Button onClick={() => go(step + 1)} disabled={busy || step + 1 > maxStep}>পরের ধাপ →</Button>}
        </div>
        {step < LAST_STEP && step + 1 > maxStep && step !== 7 && <p className="text-xs text-slate-500">পরের ধাপে যেতে এই ধাপের তথ্য যাচাই ও সংরক্ষণ করুন।</p>}
        {step !== LAST_STEP && flags.length > 0 && <Indicators items={flags} title="এখন পর্যন্ত যাচাইয়ের সূচক" />}
      </div>
    </div>
  );
}
