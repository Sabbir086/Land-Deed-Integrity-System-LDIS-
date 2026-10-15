"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button } from "@/components/ui";
import { appCall } from "./api";
import AppointmentPanel from "./AppointmentPanel";

export function WithdrawButton({ appId }) {
  const router = useRouter(); const [busy, setBusy] = useState(false); const [error, setError] = useState(null);
  async function withdraw() {
    if (!window.confirm("আবেদনটি প্রত্যাহার করবেন? প্রত্যাহারের পরে আর সম্পাদনা বা জমা দেওয়া যাবে না। Withdraw this application? This cannot be undone.")) return;
    setBusy(true); setError(null);
    const r = await appCall("withdraw", { app_id: appId });
    setBusy(false);
    if (r.error) setError(r.error); else router.refresh();
  }
  return <div className="space-y-2"><Button variant="danger" onClick={withdraw} disabled={busy}>{busy ? "…" : "আবেদন প্রত্যাহার · Withdraw"}</Button>{error && <Alert tone="error">{error}</Alert>}</div>;
}

export function DetailAppointment({ appId, appointment, events, canChange }) {
  const router = useRouter();
  return <AppointmentPanel appId={appId} appointment={appointment} events={events} canChange={canChange} onViewChange={() => router.refresh()} />;
}

export function NotificationList({ items }) {
  const router = useRouter(); const [busy, setBusy] = useState(false);
  const unread = items.filter((n) => !n.read_at).length;
  async function markAll() { setBusy(true); await appCall("notifications-read", {}); setBusy(false); router.refresh(); }
  if (items.length === 0) return <p className="text-sm text-slate-600">কোনো বিজ্ঞপ্তি নেই। · No notifications.</p>;
  return (
    <div className="space-y-2">
      <ul className="space-y-2" aria-label="Notifications">
        {items.map((n) => <li key={n.id} className={`rounded-md border p-2 text-sm ${n.read_at ? "border-slate-200 text-slate-600" : "border-brand-500 bg-brand-50 font-medium"}`}>
          {n.title_bn}<span className="block text-xs font-normal text-slate-500">{n.title_en} · {new Date(n.created_at).toLocaleString("en-GB", { timeZone: "Asia/Dhaka" })}</span></li>)}
      </ul>
      {unread > 0 && <Button variant="secondary" onClick={markAll} disabled={busy}>সব পঠিত চিহ্নিত করুন ({unread})</Button>}
    </div>
  );
}
