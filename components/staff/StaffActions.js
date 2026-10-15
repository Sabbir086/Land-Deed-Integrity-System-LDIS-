"use client";
import { useState } from "react";

export default function StaffActions({ applicationId, status }) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function act(decision) {
    setBusy(true); setMessage("");
    try {
      const r = await fetch("/api/staff/decision", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({application_id:applicationId,decision,note}) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Request failed");
      setMessage("Saved. Refreshing…"); window.location.reload();
    } catch(e) { setMessage(e.message); } finally { setBusy(false); }
  }
  async function finalize() {
    if (!window.confirm("Create a DEMO registration record? This is not an official government registration.")) return;
    setBusy(true); setMessage("");
    try {
      const r = await fetch("/api/staff/finalize", {method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({application_id:applicationId})});
      const j=await r.json(); if(!r.ok) throw new Error(j.error||"Finalization failed");
      setMessage(`DEMO reference: ${j.data.registration_ref}. Not an official registration.`); window.location.reload();
    } catch(e) { setMessage(e.message); } finally { setBusy(false); }
  }
  return <div className="space-y-3 rounded-xl border border-amber-300 bg-amber-50 p-4">
    <h3 className="font-semibold">Registrar decisions · DEMO workflow</h3>
    <label className="block text-sm">Review note / correction reason<textarea className="mt-1 w-full rounded border p-2" rows={3} value={note} onChange={e=>setNote(e.target.value)} placeholder="Explain missing or inconsistent information." /></label>
    <div className="flex flex-wrap gap-2">
      <button disabled={busy} onClick={()=>act("start_review")} className="rounded bg-slate-800 px-3 py-2 text-white disabled:opacity-50">Start review</button>
      <button disabled={busy||note.trim().length<5} onClick={()=>act("request_correction")} className="rounded bg-amber-700 px-3 py-2 text-white disabled:opacity-50">Request correction</button>
      <button disabled={busy} onClick={()=>act("confirm_appointment")} className="rounded border px-3 py-2 disabled:opacity-50">Confirm appointment</button>
      <button disabled={busy} onClick={()=>act("mark_biometric_completed")} className="rounded border px-3 py-2 disabled:opacity-50">Record biometric completed</button>
      <button disabled={busy} onClick={()=>act("mark_biometric_failed")} className="rounded border px-3 py-2 disabled:opacity-50">Record biometric failed</button>
      <button disabled={busy} onClick={()=>act("reject")} className="rounded border border-red-300 px-3 py-2 text-red-700 disabled:opacity-50">Reject</button>
      {status==="under_review" && <button disabled={busy} onClick={finalize} className="rounded bg-emerald-700 px-3 py-2 text-white disabled:opacity-50">Finalize DEMO registration</button>}
    </div>
    {message && <p role="status" className="text-sm">{message}</p>}
    <p className="text-xs text-slate-600">Actions are re-authorized in PostgreSQL. “Biometric completed” records staff-entered status only; no physical capture occurs.</p>
  </div>;
}
