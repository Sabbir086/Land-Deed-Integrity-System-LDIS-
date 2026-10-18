"use client";

import { useState } from "react";
import { useRegistrarChecklist } from "./RegistrarChecklist";
import { isAttestationScore } from "@/lib/applications/steps";

function ActionButton({ children, onClick, disabled, tone = "neutral" }) {
  const styles = {
    dark: "bg-slate-800 text-white hover:bg-slate-900",
    green: "bg-emerald-700 text-white hover:bg-emerald-800",
    amber: "bg-amber-700 text-white hover:bg-amber-800",
    red: "border border-red-300 bg-white text-red-700 hover:bg-red-50",
    neutral: "border border-slate-300 bg-white text-slate-800 hover:bg-slate-50",
  };
  return <button type="button" disabled={disabled} onClick={onClick} className={`ldis-staff-action-button rounded-lg px-3 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-45 ${styles[tone]}`}>{children}</button>;
}

function WorkflowStep({ number, title, description, children, done = false }) {
  return <section className={`ldis-staff-workflow-step ${done ? "is-done" : ""}`}>
    <div className="ldis-staff-workflow-step-inner">
      <span className="ldis-staff-workflow-index">{done ? "✓" : number}</span>
      <div className="min-w-0 flex-1">
        <h4 className="font-semibold">{title}</h4>
        <p className="mt-1 text-sm text-slate-600">{description}</p>
        {children && <div className="mt-3 flex flex-wrap gap-2">{children}</div>}
      </div>
    </div>
  </section>;
}

export default function StaffActions({
  applicationId,
  application,
  status,
  ownership,
  documents = [],
  appointments = [],
  governmentInterest = false,
  registrarApproved = false,
}) {
  const checklist = useRegistrarChecklist();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [completed, setCompleted] = useState(null);
  const [affidavitDeclarationConfirmed, setAffidavitDeclarationConfirmed] = useState(false);

  const nameScore = ownership?.route === "record_owner" && ownership.name_score != null ? Number(ownership.name_score) : null;
  const fatherScore = ownership?.route === "record_owner" && ownership.father_score != null ? Number(ownership.father_score) : null;
  const attestationRequired = isAttestationScore(nameScore) || isAttestationScore(fatherScore);
  const affidavitRequired = nameScore !== null && nameScore < 0.5;
  const bookedAppointment = appointments.some((x) => ["booked", "rescheduled"].includes(x.status));
  const confirmedAppointment = appointments.some((x) => ["confirmed", "completed"].includes(x.status));
  const reviewable = ["submitted", "under_review", "discrepancy_review", "correction_requested"].includes(status);
  const blockers = Array.isArray(application?.blockers) ? application.blockers : [];
  const affidavitDeclared = application?.affidavit_declaration === true;
  const attestationVerified = ownership?.attestation_verified === true;
  const attestationNo = ownership?.attestation_no || null;
  const affidavitDeclarationText = "আমি আবেদনকারীর মূল Affidavit নিজে দেখেছি এবং সংশ্লিষ্ট আদালত থেকে ম্যানুয়ালি যাচাই করেছি। Affidavit-এ কোনো অসঙ্গতি, জালিয়াতি বা ভুল থাকলে তার দায় আমি, দায়িত্বপ্রাপ্ত সাব-রেজিস্ট্রার, গ্রহণ করছি।";
  const biometricComplete = application?.biometric_status === "completed";
  const approvalReady = status === "under_review" && !governmentInterest && checklist.ready && blockers.length === 0 && biometricComplete &&
    (!attestationRequired || attestationVerified) && (!affidavitRequired || affidavitDeclared) && !registrarApproved;
  const finalizationReady = status === "under_review" && !governmentInterest && registrarApproved && checklist.ready && blockers.length === 0 && biometricComplete &&
    (!attestationRequired || attestationVerified) && (!affidavitRequired || affidavitDeclared);
  const hasIdentityException = attestationRequired || affidavitRequired;
  const identityEvidenceReady = (!attestationRequired || attestationVerified) && (!affidavitRequired || affidavitDeclared);
  const appointmentStep = 3;
  const identityStep = 4;
  const approvalStep = 5;
  const finalizeStep = 6;

  async function act(decision, decisionNote = note) {
    setBusy(true);
    setMessage("");
    try {
      const r = await fetch("/api/staff/decision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ application_id: applicationId, decision, note: decisionNote }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "অনুরোধটি সম্পন্ন হয়নি।");
      setMessage("সিদ্ধান্ত সংরক্ষিত হয়েছে। পৃষ্ঠা হালনাগাদ হচ্ছে…");
      window.location.reload();
    } catch (error) {
      setMessage(error.message || "অনুরোধটি সম্পন্ন হয়নি।");
    } finally {
      setBusy(false);
    }
  }

  async function finalize() {
    if (!window.confirm("Create a DEMO registration record? This is not an official government registration.")) return;
    setBusy(true);
    setMessage("");
    try {
      const r = await fetch("/api/staff/finalize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ application_id: applicationId }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "নিবন্ধন-ডেমো সম্পন্ন হয়নি।");
      setCompleted(j.data || {});
      setMessage(`ডেমো নিবন্ধন সম্পন্ন। দলিল নম্বর: ${j.data?.demo_deed_no || "তৈরি হয়েছে"} · রেফারেন্স: ${j.data?.registration_ref || "—"}। এটি সরকারি দলিল নম্বর নয়।`);
    } catch (error) {
      setMessage(error.message || "নিবন্ধন-ডেমো সম্পন্ন হয়নি।");
    } finally {
      setBusy(false);
    }
  }

  if (status === "registered" || completed) {
    return <div className="space-y-3 rounded-xl border border-emerald-300 bg-emerald-50 p-4">
      <h3 className="text-lg font-semibold text-emerald-900">ডেমো নিবন্ধন সম্পন্ন</h3>
      <p className="text-sm text-emerald-900">{message || "এই আবেদনটি ইতোমধ্যে registered অবস্থায় আছে।"}</p>
      <div className="flex flex-wrap gap-2"><a href={`/registered-deeds/${applicationId}/print`} className="inline-flex rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white">ডেমো দলিল প্রিন্ট করুন</a><button type="button" onClick={() => window.location.reload()} className="rounded-lg border px-3 py-2 text-sm">পৃষ্ঠা Refresh</button></div>
      <p className="text-xs text-slate-600">DEMO ONLY — এটি সরকারি নিবন্ধন নয় এবং আইনগত দলিলের বিকল্প নয়।</p>
    </div>;
  }

  return <div className="ldis-staff-registration space-y-4 rounded-xl border p-4">
    <div className="ldis-staff-registration-heading">
      <h3 className="text-xl font-bold">সাব-রেজিস্ট্রারের সিদ্ধান্ত ও নিবন্ধন ধাপ</h3>
      <p className="mt-1 text-sm text-slate-600">নিচের ধাপগুলো ক্রমানুসারে সম্পন্ন করুন। “Approve” এবং “Finalize” আলাদা সিদ্ধান্ত; আগে অনুমোদন রেকর্ড না করলে নিবন্ধন সম্পন্ন হবে না।</p>
    </div>

    {governmentInterest ? <>
      <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-900">
        <strong>নিবন্ধন নিষিদ্ধ:</strong> সরকারি স্বার্থ/নিষেধাজ্ঞার রেকর্ড আছে। Start review, correction, appointment, biometric, attestation/affidavit confirmation, approval ও finalization—সব বন্ধ। এই আবেদনে কেবল Reject করা যাবে।
      </div>
      <label className="block text-sm font-medium">প্রত্যাখ্যানের কারণ <span className="text-red-700">(কমপক্ষে ৫ অক্ষর)</span>
        <textarea className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2" rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="সরকারি স্বার্থের রেকর্ড, সংশ্লিষ্ট দাগ এবং রেফারেন্স লিখুন।" />
      </label>
      <ActionButton tone="red" disabled={busy || note.trim().length < 5 || !reviewable} onClick={() => act("reject")}>{busy ? "সংরক্ষণ হচ্ছে…" : "আবেদন প্রত্যাখ্যান করুন · Reject"}</ActionButton>
    </> : <>
      <label className="block text-sm font-medium">রিভিউ নোট / সংশোধনের কারণ
        <textarea className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="কোনো তথ্য অসম্পূর্ণ/ভুল হলে কারণ লিখুন। Reject করলে কারণ লিখুন।" />
      </label>

      <div className="space-y-3">
        <WorkflowStep number={1} title="আবেদন Review শুরু করুন" description="Submitted বা discrepancy review আবেদনে review শুরু করে Under review অবস্থায় আনুন। ভুল/অসম্পূর্ণ তথ্য থাকলে correction চাইতে পারেন." done={status === "under_review"}>
          {status !== "under_review" && reviewable && <ActionButton tone="dark" disabled={busy} onClick={() => act("start_review")}>পর্যালোচনা শুরু</ActionButton>}
          {reviewable && status !== "correction_requested" && <ActionButton tone="amber" disabled={busy || note.trim().length < 5} onClick={() => act("request_correction")}>সংশোধন চাইুন</ActionButton>}
          {reviewable && <ActionButton tone="red" disabled={busy || (note.trim().length < 5 && !governmentInterest)} onClick={() => act("reject")}>Reject</ActionButton>}
        </WorkflowStep>

        <WorkflowStep number={2} title="১২টি যাচাই প্রশ্ন সংরক্ষণ করুন" description="আবেদন, পক্ষ, মালিকানা, দাগ, সরকারি স্বার্থ, নথি, ফি, চালান ও অ্যাপয়েন্টমেন্টের নিচে থাকা প্রশ্নগুলোর উত্তর দিয়ে সবগুলো সঠিক অবস্থায় সংরক্ষণ করুন।" done={checklist.ready}>
          <span className={`text-sm font-semibold ${checklist.ready ? "text-emerald-700" : "text-amber-700"}`}>{checklist.ready ? "১২/১২ সঠিক ও সংরক্ষিত" : "চেকলিস্ট সম্পূর্ণ সংরক্ষিত নয়"}</span>
        </WorkflowStep>

        <WorkflowStep number={appointmentStep} title="অ্যাপয়েন্টমেন্ট ও বায়োমেট্রিক" description="প্রথমে বুক করা অ্যাপয়েন্টমেন্ট নিশ্চিত করুন, এরপর অফিসে পরিচয়/বায়োমেট্রিক প্রক্রিয়া শেষ হলে completed status নথিভুক্ত করুন।" done={biometricComplete}>
          {status === "under_review" && bookedAppointment && <ActionButton disabled={busy} onClick={() => act("confirm_appointment")}>অ্যাপয়েন্টমেন্ট নিশ্চিত করুন</ActionButton>}
          {status === "under_review" && confirmedAppointment && !biometricComplete && <ActionButton tone="green" disabled={busy} onClick={() => act("mark_biometric_completed")}>বায়োমেট্রিক সম্পন্ন হয়েছে</ActionButton>}
          {status === "under_review" && confirmedAppointment && !biometricComplete && <ActionButton tone="red" disabled={busy} onClick={() => act("mark_biometric_failed")}>বায়োমেট্রিক ব্যর্থ</ActionButton>}
          {biometricComplete && <span className="text-sm font-semibold text-emerald-700">বায়োমেট্রিকের অবস্থা completed</span>}
          {!bookedAppointment && !confirmedAppointment && !biometricComplete && <span className="text-sm text-amber-800">সিস্টেমে বুক করা অ্যাপয়েন্টমেন্ট পাওয়া যায়নি।</span>}
        </WorkflowStep>

        <WorkflowStep number={identityStep} title={attestationRequired ? "প্রত্যয়ন নম্বরের ফলাফল" : affidavitRequired ? "সাব-রেজিস্ট্রারের Affidavit ঘোষণা" : "পরিচয়-সংক্রান্ত অতিরিক্ত শর্ত"} description={attestationRequired ? `নামের মিল ${nameScore === null ? "—" : `${Math.round(nameScore * 100)}%`}, পিতার নামের মিল ${fatherScore === null ? "—" : `${Math.round(fatherScore * 100)}%`}। আবেদনকারী ধাপ ৩-এ প্রত্যয়নপত্র নম্বর দিয়ে reference database-এ যাচাই করেছেন কি না দেখুন।` : affidavitRequired ? `নামের মিল ${Math.round(nameScore * 100)}%। Affidavit-এর কোনো database, upload বা online verification নেই। বায়োমেট্রিকের পরে সাব-রেজিস্ট্রার নিজে মূল Affidavit ও আদালতের manual verification সম্পর্কে দায়-স্বীকার ঘোষণা দেবেন।` : "এই আবেদনে অতিরিক্ত প্রত্যয়ন বা Affidavit শর্ত প্রযোজ্য নয়."} done={identityEvidenceReady}>
          {attestationRequired && attestationVerified && <div className="w-full rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">আবেদনকারীর প্রত্যয়ন নম্বর যাচাই সফল: <strong>{attestationNo || "নম্বর সংরক্ষিত"}</strong>। Sub-Registrar চূড়ান্তভাবে পর্যালোচনা করবেন।</div>}
          {attestationRequired && !attestationVerified && <div className="ldis-staff-review-note w-full rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">নামের মিল {nameScore === null ? "—" : `${Math.round(nameScore * 100)}%`} / পিতার নামের মিল {fatherScore === null ? "—" : `${Math.round(fatherScore * 100)}%`}। প্রত্যয়ন নম্বর যাচাই পাওয়া যায়নি। আবেদনকারীকে ধাপ ৩-এ নম্বর দিয়ে verify করতে বলুন; ফাইল upload বাধ্যতামূলক নয়।</div>}
          {affidavitRequired && !biometricComplete && <p className="w-full text-sm text-amber-800">প্রথমে Appointment ও biometric completed করুন; তার পরেই এই declaration দেওয়া যাবে।</p>}
          {affidavitRequired && !affidavitDeclared && biometricComplete && <div className="w-full space-y-3 rounded-lg border border-amber-300 bg-amber-50 p-3">
            <p className="text-sm font-semibold text-amber-950">দায়-স্বীকার ঘোষণা (শুধু দায়িত্বপ্রাপ্ত সাব-রেজিস্ট্রার)</p>
            <p className="text-sm text-amber-950">{affidavitDeclarationText}</p>
            <label className="flex items-start gap-2 text-sm text-amber-950">
              <input type="checkbox" className="mt-1" checked={affidavitDeclarationConfirmed} onChange={(e) => setAffidavitDeclarationConfirmed(e.target.checked)} />
              <span>আমি ঘোষণা করছি যে মূল Affidavit নিজে দেখেছি, আদালত থেকে ম্যানুয়ালি যাচাই করেছি এবং কোনো অসঙ্গতি থাকলে দায়ভার গ্রহণ করছি।</span>
            </label>
            <ActionButton tone="amber" disabled={busy || status !== "under_review" || !affidavitDeclarationConfirmed} onClick={() => act("declare_affidavit_checked", affidavitDeclarationText)}>ঘোষণা সংরক্ষণ ও দায় গ্রহণ করুন</ActionButton>
            <p className="text-xs text-amber-900">এই ঘোষণাটি আলাদা Affidavit database/table-এ নয়; সাব-রেজিস্ট্রারের পরিচয়সহ audit log-এ সংরক্ষিত হবে।</p>
          </div>}
          {affidavitRequired && affidavitDeclared && <div className="w-full rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900"><strong>সাব-রেজিস্ট্রারের ঘোষণা সংরক্ষিত</strong><p className="mt-1">{application.affidavit_declaration_text || affidavitDeclarationText}</p><p className="mt-1 text-xs">সময়: {application.affidavit_declaration_at || "—"} · ঘোষণা দেওয়া কর্মকর্তার ID: {application.affidavit_declaration_by || "—"}</p></div>}
          {!hasIdentityException && <span className="text-sm font-semibold text-emerald-700">এই আবেদনে অতিরিক্ত প্রত্যয়ন/Affidavit প্রয়োজন নেই</span>}
        </WorkflowStep>

        <WorkflowStep number={approvalStep} title="নিবন্ধন অনুমোদন (Approve)" description="চেকলিস্টের ১২টি সিদ্ধান্ত, সিস্টেম blocker, বায়োমেট্রিক এবং নাম-সংক্রান্ত প্রত্যয়ন নম্বর/Affidavit দায়-স্বীকার শর্ত পূরণ হলেই অনুমোদন দিন." done={registrarApproved}>
          {!registrarApproved && <ActionButton tone="green" disabled={busy || !approvalReady} onClick={() => act("approve")}>Approve registration</ActionButton>}
          {!registrarApproved && !approvalReady && <p className="w-full text-sm text-amber-800">Approve চালু করতে চেকলিস্ট ১২/১২ সঠিকভাবে Save, সব system blocker সমাধান, বায়োমেট্রিক completed এবং প্রয়োজন অনুযায়ী প্রত্যয়ন নম্বর verification অথবা সাব-রেজিস্ট্রারের মূল Affidavit/আদালত manual-check দায়-স্বীকার ঘোষণা সম্পন্ন থাকতে হবে।</p>}
          {registrarApproved && <span className="text-sm font-semibold text-emerald-700">Registrar approval audit-এ সংরক্ষিত হয়েছে</span>}
        </WorkflowStep>

        <WorkflowStep number={finalizeStep} title="ডেমো দলিল Register / Finalize" description="Approve সফলভাবে রেকর্ড হওয়ার পরই এই শেষ ধাপ চালু হবে। এটি শুধু LDIS demo archive-এ রেকর্ড তৈরি করে, সরকারি নিবন্ধন করে না." done={Boolean(completed)}>
          <ActionButton tone="green" disabled={busy || !finalizationReady} onClick={finalize}>{busy ? "নিবন্ধন হচ্ছে…" : "Finalize DEMO registration"}</ActionButton>
          {!registrarApproved && <p className="w-full text-sm text-slate-600">আগে ৫ নম্বর ধাপে Approve করুন। তাই এখন Finalize করা যাবে না।</p>}
        </WorkflowStep>
      </div>
    </>}

    {message && <div role="status" className="rounded-lg border border-slate-200 bg-white p-3 text-sm">{message}</div>}
    {completed && <div className="flex flex-wrap gap-2"><a href={`/registered-deeds/${applicationId}/print`} className="inline-flex rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white">ডেমো দলিল প্রিন্ট করুন</a><button type="button" onClick={() => window.location.reload()} className="rounded-lg border bg-white px-3 py-2 text-sm">Refresh</button></div>}
    <p className="text-xs text-slate-500">Actions are validated again in PostgreSQL. “Biometric completed” is a staff-entered status only; this application does not capture biometrics. DEMO workflow only.</p>
  </div>;
}
