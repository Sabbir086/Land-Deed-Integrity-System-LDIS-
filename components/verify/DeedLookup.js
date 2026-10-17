"use client";
import { useState } from "react";
import { Alert, Button, Card, DataTable, Field, Input, Spinner } from "@/components/ui";
import { useLookup } from "./api";
import Indicators from "./Indicators";
import { fmtArea, fmtDate } from "@/lib/utils";

export default function DeedLookup() {
  const [no, setNo] = useState(""); const [date, setDate] = useState("");
  const [st, run] = useLookup();
  const d = st.data;
  return (
    <div className="space-y-4">
      <Card title="দলিল নম্বর ও তারিখ">
        <form onSubmit={(e) => { e.preventDefault(); run("/api/verify/deed", { deed_no: no, deed_date: date }); }} className="grid gap-4 sm:grid-cols-3 sm:items-end">
          <Field label="দলিল নম্বর · Deed no." htmlFor="deed-no" hint="যেমন ৫০০১/২০২৩ বা 5001/2023"><Input id="deed-no" value={no} onChange={(e) => setNo(e.target.value)} /></Field>
          <Field label="দলিলের তারিখ · Deed date (ঐচ্ছিক)" htmlFor="deed-date"><Input id="deed-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
          <Button type="submit" disabled={st.loading || !no}>অনুসন্ধান</Button>
        </form>
        {st.loading && <div className="mt-3"><Spinner /></div>}
      </Card>
      {st.error && <Alert tone="error">{st.error}</Alert>}
      {d && (
        <>
          <Indicators items={d.indicators} />
          {d.candidates.length > 0 && (
            <Card title={`${d.candidates.length}টি সম্ভাব্য রেকর্ড`} subtitle="Source: project deed reference table (dummy data)">
              <DataTable caption="Deed candidates" rows={d.candidates}
                columns={[
                  { key: "deed_no", label: "নম্বর" }, { key: "deed_date", label: "তারিখ", render: (r) => fmtDate(r.deed_date) }, { key: "deed_type", label: "ধরন" },
                  { key: "donor_name", label: "দাতা" }, { key: "donee_name", label: "গ্রহীতা" },
                  { key: "loc", label: "তফসিল", render: (r) => `${r.mouza || "—"}, ${r.upazila || "—"}, ${r.district || "—"} · খতিয়ান ${r.khatian_no || "—"} · দাগ ${r.dag_no || "—"}` },
                  { key: "area_sold", label: "বিক্রিত", render: (r) => fmtArea(r.area_sold) },
                  { key: "reg", label: "নিবন্ধন", render: (r) => `${r.sub_office || "—"} (${fmtDate(r.registered_on)})` },
                  { key: "prev", label: "পূর্ববর্তী দলিল", render: (r) => (r.prev_deed_no ? `${r.prev_deed_no} (${fmtDate(r.prev_deed_date)})` : "—") },
                ]} />
              <div className="mt-5 space-y-4">
                {d.candidates.map((candidate, index) => (
                  <section key={`${candidate.deed_no}-${candidate.deed_date}-${index}`} className="rounded-lg border border-slate-200 p-3">
                    <h3 className="font-semibold">দলিল {candidate.deed_no} — অতিরিক্ত তফসিল ও সাক্ষী</h3>
                    <dl className="mt-2 grid gap-1 text-sm sm:grid-cols-2">
                      <div><dt className="inline text-slate-500">দাতার পিতার নাম: </dt><dd className="inline">{candidate.donor_father_name || "—"}</dd></div>
                      <div><dt className="inline text-slate-500">গ্রহীতার পিতার নাম: </dt><dd className="inline">{candidate.donee_father_name || "—"}</dd></div>
                      <div><dt className="inline text-slate-500">দলিলের মূল্য: </dt><dd className="inline">{candidate.deed_value ? `৳ ${Number(candidate.deed_value).toLocaleString("en-IN")}` : "—"}</dd></div>
                    </dl>
                    {!!candidate.parcels?.length && <div className="mt-3 overflow-x-auto"><table className="w-full border-collapse text-sm"><thead><tr className="bg-slate-50"><th className="border p-2 text-left">তফসিল</th><th className="border p-2 text-left">লোকেশন</th><th className="border p-2 text-left">খতিয়ান</th><th className="border p-2 text-left">দাগ</th><th className="border p-2 text-left">শ্রেণি</th><th className="border p-2 text-right">জমি</th></tr></thead><tbody>{candidate.parcels.map((parcel) => <tr key={`${candidate.deed_no}-${parcel.serial}`}><td className="border p-2">{parcel.serial}</td><td className="border p-2">{[parcel.mouza,parcel.upazila,parcel.district].filter(Boolean).join(", ") || "—"}</td><td className="border p-2">{parcel.khatian_type || "—"} · {parcel.khatian_no}</td><td className="border p-2">{parcel.dag_no}</td><td className="border p-2">{parcel.land_class || "—"}</td><td className="border p-2 text-right">{fmtArea(parcel.area)}</td></tr>)}</tbody></table></div>}
                    {!!candidate.witnesses?.length && <div className="mt-3"><h4 className="text-sm font-semibold">সাক্ষী</h4><ul className="mt-1 grid gap-2 text-sm sm:grid-cols-2">{candidate.witnesses.map((w) => <li key={w.serial} className="rounded bg-slate-50 p-2">{w.serial}. {w.name}{w.father_name ? ` — পিতা: ${w.father_name}` : ""}</li>)}</ul></div>}
                  </section>
                ))}
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
