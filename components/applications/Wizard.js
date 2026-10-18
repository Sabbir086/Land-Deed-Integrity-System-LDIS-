"use client";
import { useCallback, useState } from "react";
import Link from "next/link";
import { Alert, Badge, Button } from "@/components/ui";
import Indicators from "@/components/verify/Indicators";
import StatusBadge from "./StatusBadge";
import { appCall } from "./api";
import { STEPS, LAST_STEP, maxReachableStep, stepDone, needsAttestation } from "@/lib/applications/steps";
import { sortIndicators } from "@/lib/verify/risk";
import DeedNatureGate from "./DeedNatureGate";
import StepParties from "./StepParties"; import StepLand from "./StepLand"; import StepOwnership from "./StepOwnership";
import StepPlots from "./StepPlots"; import StepDetails from "./StepDetails"; import StepFees from "./StepFees";
import StepDocuments from "./StepDocuments"; import StepAppointment from "./StepAppointment"; import StepReview from "./StepReview";

const BODY = { 1: StepParties, 2: StepLand, 3: StepOwnership, 4: StepPlots, 5: StepDetails, 6: StepFees, 7: StepDocuments, 8: StepAppointment, 9: StepReview };
const STEP_MARKS = ["01", "02", "03", "04", "05", "06", "07", "08", "09"];
const STEP_HINTS = [
  "দাতা ও গ্রহীতার পরিচয় যাচাই",
  "জমির রেকর্ড ও খতিয়ান নির্বাচন",
  "মালিকানার ভিত্তি যাচাই",
  "দাগ ও জমির পরিমাণ নির্বাচন",
  "জমির শ্রেণি ও মূল্য নির্ধারণ",
  "ফি ও চালানের তথ্য",
  "প্রয়োজনীয় কাগজপত্র",
  "অ্যাপয়েন্টমেন্ট বুকিং",
  "সব তথ্য দেখে আবেদন জমা",
];

export default function Wizard({ initial }) {
  const [view, setView] = useState(initial);
  const [step, setStep] = useState(Math.min(
    Math.max(initial.application.current_step || 1, 1),
    maxReachableStep(initial),
  ));
  const [busy, setBusy] = useState(false); const [error, setError] = useState(null);
  const appId = view.application.id;
  const maxStep = maxReachableStep(view);

  const call = useCallback(async (action, body = {}) => {
    setBusy(true); setError(null);
    const r = await appCall(action, { app_id: appId, ...body });
    setBusy(false);
    if (r.error) setError(r.error); else if (r.data?.application) {
      setView(r.data.application);
      // A very low recorded-owner name match uses an affidavit-at-biometric workflow.
      // It is instruction-only on the applicant side; the Sub-Registrar records receipt later.
      if (action === "ownership" && r.data.application.ownership?.route === "record_owner") {
        const score = r.data.application.ownership?.name_score;
        if (score !== null && score !== undefined && Number(score) < 0.5) {
          setStep(4);
          appCall("progress", { app_id: appId, step: 4 });
          if (typeof window !== "undefined") window.scrollTo({ top: 0 });
        }
      }
    }
    return r;
  }, [appId]);

  function go(n) {
    if (n < 1 || n > LAST_STEP || n > maxStep) return;
    setStep(n); setError(null);
    appCall("progress", { app_id: appId, step: n });
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const Body = BODY[step];
  const flags = sortIndicators(view.application.flags || []);
  const completedSteps = STEPS.filter((s) => stepDone(view, s.n)).length;
  const completionPct = Math.round((completedSteps / LAST_STEP) * 100);
  const activePct = Math.max(completionPct, Math.round(((step - 1) / LAST_STEP) * 100));
  const attestationPending = needsAttestation(view) && view.identity_evidence?.attestation_verified !== true;
  const summarySteps = STEPS.map((s) => ({ ...s, done: stepDone(view, s.n) }));

  if (!view.application.deed_nature) {
    return <DeedNatureGate applicationNo={view.application.application_no} busy={busy}
      onSave={(deed_nature, deed_date) => call("nature", { deed_nature, deed_date })} />;
  }

  return (
    <div className="ldis-wizard">
      <div className="ldis-wizard-layout">
        <aside className="ldis-wizard-rail" aria-label="আবেদনের ধাপ">
          <div className="ldis-wizard-rail-head">
            <span className="ldis-wizard-eyebrow">LDIS · APPLICATION</span>
            <h2>নিবন্ধনের ধাপ</h2>
            <p>এক ধাপ করে এগিয়ে আপনার আবেদন সম্পন্ন করুন।</p>
            <div className="ldis-wizard-rail-progress">
              <div className="ldis-wizard-progress-ring" style={{ "--ldis-progress": `${completionPct}%` }}>
                <div><strong>{completedSteps}</strong><span>/{LAST_STEP}</span></div>
              </div>
              <div><strong>{completionPct}% সম্পন্ন</strong><span>যাচাই ও সংরক্ষিত ধাপ</span></div>
            </div>
          </div>
          <nav className="ldis-wizard-step-nav" aria-label="আবেদনের ৯টি ধাপ">
            <ol className="ldis-wizard-step-list">
              {STEPS.map((s) => {
                const done = stepDone(view, s.n);
                const locked = s.n > maxStep;
                const current = step === s.n;
                return <li key={s.n}>
                  <button type="button" onClick={() => go(s.n)} disabled={locked || busy}
                    aria-current={current ? "step" : undefined}
                    className={`ldis-wizard-step ${current ? "is-current" : ""} ${done ? "is-done" : ""} ${locked ? "is-locked" : ""}`}>
                    <span className="ldis-wizard-step-index">{done ? "✓" : STEP_MARKS[s.n - 1]}</span>
                    <span className="ldis-wizard-step-copy"><strong>{s.bn}</strong><small>{s.en}</small></span>
                    <span className="ldis-wizard-step-chevron" aria-hidden="true">›</span>
                  </button>
                </li>;
              })}
            </ol>
          </nav>
          <div className="ldis-wizard-rail-foot">
            <span className="ldis-wizard-foot-icon" aria-hidden="true">i</span>
            <p>প্রতিটি ধাপের তথ্য সংরক্ষণ করুন। পরে <Link href="/dashboard/applications">আমার আবেদনসমূহ</Link> থেকে চালিয়ে যেতে পারবেন।</p>
          </div>
        </aside>

        <main className="ldis-wizard-main">
          <div className="ldis-wizard-appbar">
            <div className="ldis-wizard-app-reference">
              <span className="ldis-wizard-app-icon" aria-hidden="true">▤</span>
              <div><span>আবেদন নম্বর</span><strong>{view.application.application_no}</strong></div>
            </div>
            <div className="ldis-wizard-app-status"><StatusBadge status={view.application.status} /></div>
            <div className="ldis-wizard-app-progress" aria-label={`ধাপ ${step} / ${LAST_STEP}`}>
              <div><span>ধাপ {step} / {LAST_STEP}</span><strong>{STEPS[step - 1].bn}</strong></div>
              <div className="ldis-wizard-progress-track"><span style={{ width: `${activePct}%` }} /></div>
            </div>
          </div>

          {view.application.status === "correction_requested" && (
            <Alert tone="warn" title="সংশোধনের অনুরোধ · Correction requested">{(view.corrections || []).filter((c) => !c.resolved_at).map((c) => <p key={c.id}>{c.message}</p>)}</Alert>)}
          {error && <Alert tone="error">{error}</Alert>}

          <section className="ldis-wizard-form-card" aria-labelledby="step-title">
            <header className="ldis-wizard-form-heading">
              <span className="ldis-wizard-form-step-icon">{STEP_MARKS[step - 1]}</span>
              <div className="min-w-0 flex-1">
                <span className="ldis-wizard-eyebrow">STEP {STEP_MARKS[step - 1]} / 09</span>
                <h2 id="step-title">{STEPS[step - 1].bn}</h2>
                <p>{STEP_HINTS[step - 1]} <span aria-hidden="true">·</span> {STEPS[step - 1].en}</p>
              </div>
              {stepDone(view, step) && <Badge tone="green">সংরক্ষিত</Badge>}
            </header>

            <div key={step} className="ldis-wizard-step-content">
              <Body view={view} call={call} busy={busy} go={go} setView={setView} />
            </div>

            {step < LAST_STEP && attestationPending && step === 3 && <div className="ldis-wizard-gate-note">
              <strong>পরবর্তী ধাপে যেতে প্রত্যয়ন নম্বর যাচাই করুন</strong>
              <p>নাম অথবা পিতার নামের মিল ৫০%–৯০%-এর কম হলে ধাপ ৩-এর প্রত্যয়ন নম্বর যাচাই সম্পন্ন করতে হবে। যাচাই সফল হলে পরের ধাপ খুলবে।</p>
            </div>}
            {step < LAST_STEP && !stepDone(view, step) && step + 1 > maxStep && step !== 3 && <p className="ldis-wizard-save-note">পরবর্তী ধাপ খুলতে এই ধাপের প্রয়োজনীয় তথ্য যাচাই ও সংরক্ষণ করুন।</p>}

            <footer className="ldis-wizard-form-actions">
              <Button variant="secondary" onClick={() => go(step - 1)} disabled={step === 1 || busy}>← আগের ধাপ</Button>
              <div className="ldis-wizard-next-group">
                {step < LAST_STEP && <span>{maxStep < step + 1 ? "প্রয়োজনীয় যাচাই বাকি" : `পরবর্তী: ${STEPS[step]?.bn || ""}`}</span>}
                {step < LAST_STEP && <Button onClick={() => go(step + 1)} disabled={busy || step + 1 > maxStep}>পরবর্তী ধাপ <span aria-hidden="true">→</span></Button>}
              </div>
            </footer>
          </section>
          {step < LAST_STEP && flags.length > 0 && <div className="ldis-wizard-indicators"><Indicators items={flags} title="এখন পর্যন্ত যাচাইয়ের সূচক" /></div>}
        </main>

        <aside className="ldis-wizard-summary" aria-label="আবেদনের সারাংশ">
          <section className="ldis-wizard-summary-card ldis-wizard-summary-progress">
            <div className="ldis-wizard-summary-title"><span>◷</span><h3>আবেদনের অগ্রগতি</h3></div>
            <div className="ldis-wizard-summary-score">
              <div className="ldis-wizard-progress-ring" style={{ "--ldis-progress": `${completionPct}%` }}><div><strong>{completedSteps}</strong><span>/{LAST_STEP}</span></div></div>
              <div><strong>{completionPct}%</strong><span>ধাপ সম্পন্ন</span><small>বর্তমান ধাপ {step}: {STEPS[step - 1].bn}</small></div>
            </div>
            <ol className="ldis-wizard-summary-list">
              {summarySteps.map((s) => <li key={s.n} className={s.n === step ? "is-current" : s.done ? "is-done" : ""}>
                <span>{s.done ? "✓" : s.n}</span><span>{s.bn}</span>
              </li>)}
            </ol>
          </section>
          <section className="ldis-wizard-summary-card">
            <div className="ldis-wizard-summary-title"><span>i</span><h3>আবেদনের আগে মনে রাখুন</h3></div>
            <ul className="ldis-wizard-tips">
              <li>সঠিক পরিচয় ও জমির তথ্য দিন</li>
              <li>প্রয়োজনীয় কাগজপত্র প্রস্তুত রাখুন</li>
              <li>চালান নম্বর ও ফি যাচাই করুন</li>
              <li>জমা দেওয়ার আগে সব তথ্য পর্যালোচনা করুন</li>
            </ul>
          </section>
          <Link href="/dashboard/applications" className="ldis-wizard-help-card">
            <span className="ldis-wizard-help-icon">↗</span><span><strong>আবেদন তালিকা</strong><small>আপনার আবেদন ও অগ্রগতি দেখুন</small></span><b aria-hidden="true">›</b>
          </Link>
        </aside>
      </div>
    </div>
  );
}
