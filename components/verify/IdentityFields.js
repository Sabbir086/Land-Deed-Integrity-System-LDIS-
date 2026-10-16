"use client";
import { Field, Input } from "@/components/ui";

export default function IdentityFields({ nid, dob, onNid, onDob, idPrefix = "p", dateFormat = "iso" }) {
  const displayDob = dateFormat === "dmy" && /^\d{4}-\d{2}-\d{2}$/.test(dob)
    ? `${dob.slice(8,10)}/${dob.slice(5,7)}/${dob.slice(0,4)}` : dob;
  return <div className="grid gap-4 sm:grid-cols-2">
    <Field label="NID নম্বর · NID number" htmlFor={`${idPrefix}-nid`} hint="১০–১৭ সংখ্যা (বাংলা বা ইংরেজি)">
      <Input id={`${idPrefix}-nid`} inputMode="numeric" autoComplete="off" value={nid} onChange={(e) => onNid(e.target.value)} />
    </Field>
    <Field label="জন্মতারিখ · Date of birth" htmlFor={`${idPrefix}-dob`} hint={dateFormat === "dmy" ? "দিন/মাস/বছর (DD/MM/YYYY)" : undefined}>
      <Input id={`${idPrefix}-dob`} type={dateFormat === "dmy" ? "text" : "date"} placeholder={dateFormat === "dmy" ? "DD/MM/YYYY" : undefined}
        inputMode={dateFormat === "dmy" ? "numeric" : undefined} maxLength={dateFormat === "dmy" ? 10 : undefined}
        value={displayDob} onChange={(e) => onDob(e.target.value)} />
    </Field>
  </div>;
}
