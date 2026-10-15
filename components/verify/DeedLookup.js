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
          <Field label="দলিলের তারিখ · Deed date" htmlFor="deed-date"><Input id="deed-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
          <Button type="submit" disabled={st.loading || !no || !date}>অনুসন্ধান</Button>
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
            </Card>
          )}
        </>
      )}
    </div>
  );
}
