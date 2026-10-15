"use client";
import { useState } from "react";
import { Alert, Button, Card, Field, Input, Select } from "@/components/ui";
import FeeTable from "./FeeTable";
import { LAND_CLASSES } from "@/lib/applications/status";
import { fmtArea } from "@/lib/utils";

export default function StepDetails({ view, call, busy }) {
  const plots = view.plots || [];
  const [cls, setCls] = useState(() => Object.fromEntries(plots.map((p) => [p.dag_id, p.land_class || ""])));
  const [price, setPrice] = useState(view.application.sale_price != null ? String(view.application.sale_price) : "");
  if (plots.length === 0) return <Alert tone="warn">আগে দাগ নির্বাচন করুন (ধাপ ৪)। Select dags in step 4 first.</Alert>;
  const save = (e) => { e.preventDefault(); call("details", { details: plots.map((p) => ({ dag_id: p.dag_id, land_class: cls[p.dag_id] || "" })), price }); };
  return (
    <div className="space-y-4">
      <Card title="জমির শ্রেণি ও প্রস্তাবিত মূল্য · Land class & proposed price">
        <form onSubmit={save} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            {plots.map((p) => {
              const opts = [...new Set([...LAND_CLASSES, ...(p.recorded_land_class ? [p.recorded_land_class] : [])])];
              return (
                <Field key={p.id} label={`দাগ ${p.dag_no} (${fmtArea(p.area_sold)}) — শ্রেণি`} htmlFor={`c-${p.id}`} hint={p.recorded_land_class ? `পর্চার শ্রেণি: ${p.recorded_land_class}` : undefined}>
                  <Select id={`c-${p.id}`} value={cls[p.dag_id] || ""} onChange={(e) => setCls((c) => ({ ...c, [p.dag_id]: e.target.value }))}><option value="">— নির্বাচন —</option>{opts.map((o) => <option key={o}>{o}</option>)}</Select>
                </Field>);
            })}
          </div>
          <div className="max-w-xs"><Field label="প্রস্তাবিত বিক্রয়মূল্য (টাকা) · Proposed sale price" htmlFor="price" hint="ফি এই মূল্যের ভিত্তিতে গণনা হয়"><Input id="price" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} /></Field></div>
          <Button type="submit" disabled={busy || !price}>{busy ? "সংরক্ষণ হচ্ছে…" : "সংরক্ষণ ও ফি গণনা · Save & calculate fees"}</Button>
        </form>
      </Card>
      <Card title="ফি-এর হিসাব · Fee breakdown"><FeeTable items={view.fee_items} total={view.application.fee_total} /></Card>
    </div>
  );
}
