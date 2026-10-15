"use client";
import { useEffect, useState } from "react";
import { Alert, Badge, Button, Card, Spinner } from "@/components/ui";
import { appCall } from "./api";
import { fmtDay } from "@/lib/applications/format";

// Booking a visit is NOT biometric completion. Office confirmation / attendance marking is Stage 3.
export default function AppointmentPanel({ appId, appointment, events = [], canChange, onViewChange }) {
  const [avail, setAvail] = useState({ loading: true, error: null, data: null });
  const [day, setDay] = useState(""); const [slot, setSlot] = useState("");
  const [busy, setBusy] = useState(false); const [error, setError] = useState(null);

  useEffect(() => {
    if (!canChange) { setAvail({ loading: false, error: null, data: null }); return; }
    let live = true;
    appCall("appointment-availability", { app_id: appId }).then((r) => { if (live) setAvail({ loading: false, error: r.error || null, data: r.data || null }); });
    return () => { live = false; };
  }, [appId, canChange, appointment?.id]);

  async function act(action, body) {
    setBusy(true); setError(null);
    const r = await appCall(action, { app_id: appId, ...body });
    setBusy(false);
    if (r.error) { setError(r.error); return; }
    setDay(""); setSlot("");
    if (r.data?.application) onViewChange(r.data.application);
  }
  const days = avail.data?.days || [];
  const slots = days.find((d) => d.date === day)?.slots || [];
  return (
    <div className="space-y-4">
      <Alert tone="warn" title="গুরুত্বপূর্ণ · Important">তারিখ বুক করা মানে বায়োমেট্রিক (ছবি ও ফিঙ্গারপ্রিন্ট) সম্পন্ন হওয়া নয়। সাব-রেজিস্ট্রারের অফিসে উপস্থিত হয়ে তা দিতে হবে এবং অফিস নিশ্চিত করবে। Booking a date is not completed biometric verification; it is confirmed by the office at the visit.</Alert>
      {appointment && (
        <Card title="বর্তমান বুকিং · Current booking" actions={<Badge tone="blue">{appointment.status}</Badge>}>
          <p className="text-sm"><span className="font-semibold">{fmtDay(appointment.appt_date)}</span> · {appointment.slot} · {appointment.office_upazila}, {appointment.office_district} সাব-রেজিস্ট্রি অফিস</p>
          {canChange && appointment.status === "booked" && <div className="mt-3"><Button variant="secondary" disabled={busy} onClick={() => act("appointment-cancel", {})}>বুকিং বাতিল · Cancel booking</Button></div>}
          {appointment.status === "confirmed" && <p className="mt-2 text-xs text-slate-500">অফিস নিশ্চিত করেছে; পরিবর্তনের জন্য অফিসে যোগাযোগ করুন।</p>}
        </Card>)}
      {events.length > 0 && <details className="text-sm"><summary className="cursor-pointer font-medium">বুকিং ইতিহাস · Booking history ({events.length})</summary><ul className="mt-2 space-y-1">{events.map((e, i) => <li key={i} className="text-slate-600">{new Date(e.created_at).toLocaleString("en-GB", { timeZone: "Asia/Dhaka" })} — {e.event}{e.detail ? ` (${e.detail})` : ""}</li>)}</ul></details>}
      {canChange ? (
        <Card title={appointment ? "অন্য তারিখে বদলান · Reschedule" : "তারিখ বেছে নিন · Choose a date"} subtitle="শুধু কর্মদিবস দেখানো হচ্ছে; শুক্র-শনি বাদ">
          {avail.loading && <Spinner />}
          {avail.error && <Alert tone="warn">{avail.error}</Alert>}
          {!avail.loading && !avail.error && (
            <div className="space-y-4">
              {avail.data?.rules?.is_demo && <p className="text-xs text-amber-800">ডেমো সময়সূচি/ধারণক্ষমতা। কোনো সরকারি ছুটির তালিকা {avail.data.holidays_configured ? "কনফিগার করা আছে।" : "এখনো কনফিগার করা হয়নি — ছুটির দিনও দেখাতে পারে।"} Demo availability rules.</p>}
              {days.length === 0 && <Alert tone="info">কোনো তারিখ পাওয়া যায়নি।</Alert>}
              <div role="group" aria-label="Available dates" className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                {days.map((d) => {
                  const free = d.slots.reduce((s, x) => s + x.free, 0);
                  return <button key={d.date} type="button" disabled={free === 0} aria-pressed={day === d.date} onClick={() => { setDay(d.date); setSlot(""); }}
                    className={`rounded-md border px-2 py-2 text-left text-xs disabled:cursor-not-allowed disabled:opacity-50 ${day === d.date ? "border-brand-600 bg-brand-50" : "border-slate-300 bg-white hover:border-brand-500"}`}>
                    <span className="block font-semibold">{fmtDay(d.date)}</span><span className="text-slate-500">{free ? `${free} খালি` : "পূর্ণ"}</span></button>;
                })}
              </div>
              {day && (
                <div><p className="mb-2 text-sm font-medium">সময় · Time slot</p>
                  <div role="group" aria-label="Time slots" className="flex flex-wrap gap-2">
                    {slots.map((s) => <button key={s.slot} type="button" disabled={s.free === 0} aria-pressed={slot === s.slot} onClick={() => setSlot(s.slot)}
                      className={`rounded-md border px-3 py-1.5 text-sm disabled:opacity-50 ${slot === s.slot ? "border-brand-600 bg-brand-50 font-semibold" : "border-slate-300 bg-white"}`}>{s.slot} <span className="text-xs text-slate-500">({s.free})</span></button>)}
                  </div>
                </div>)}
              <Button disabled={busy || !day || !slot} onClick={() => act("appointment-book", { date: day, slot })}>{busy ? "বুক হচ্ছে…" : appointment ? "নতুন তারিখ নিশ্চিত করুন" : "বুক করুন · Book"}</Button>
            </div>)}
        </Card>
      ) : <Alert tone="info">এই অবস্থায় অ্যাপয়েন্টমেন্ট পরিবর্তন করা যায় না।</Alert>}
      {error && <Alert tone="error">{error}</Alert>}
    </div>
  );
}
