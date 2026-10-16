"use client";
import { Field, Input } from "@/components/ui";

export default function IdentityFields({ nid, dob, onNid, onDob, idPrefix = "p", dateFormat = "iso" }) {
  // Keep dates as ISO (YYYY-MM-DD) internally so native calendar input works
  // and API/database values are unambiguous. The browser renders the calendar
  // control in the user's locale.
  return <div className="grid gap-4 sm:grid-cols-2">
    <Field label="NID নম্বর · NID number" htmlFor={`${idPrefix}-nid`} hint="১০–১৭ সংখ্যা (বাংলা বা ইংরেজি)">
      <Input id={`${idPrefix}-nid`} inputMode="numeric" autoComplete="off" value={nid} onChange={(e) => onNid(e.target.value)} />
    </Field>
    <Field label="জন্মতারিখ · Date of birth" htmlFor={`${idPrefix}-dob`} hint={dateFormat === "dmy" ? "ক্যালেন্ডার থেকে তারিখ নির্বাচন করুন (DD/MM/YYYY)" : undefined}>
      <Input id={`${idPrefix}-dob`} type="date" autoComplete="bday"
        value={dob && /^\\d{4}-\\d{2}-\\d{2}$/.test(dob) ? dob : ""}
        onChange={(e) => onDob(e.target.value)} />
    </Field>
  </div>;
}
