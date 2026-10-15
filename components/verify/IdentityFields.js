"use client";
import { Field, Input } from "@/components/ui";

export default function IdentityFields({ nid, dob, onNid, onDob, idPrefix = "p" }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="NID নম্বর · NID number" htmlFor={`${idPrefix}-nid`} hint="১০–১৭ সংখ্যা (বাংলা বা ইংরেজি)">
        <Input id={`${idPrefix}-nid`} inputMode="numeric" autoComplete="off" value={nid} onChange={(e) => onNid(e.target.value)} />
      </Field>
      <Field label="জন্মতারিখ · Date of birth" htmlFor={`${idPrefix}-dob`}>
        <Input id={`${idPrefix}-dob`} type="date" value={dob} onChange={(e) => onDob(e.target.value)} />
      </Field>
    </div>
  );
}
