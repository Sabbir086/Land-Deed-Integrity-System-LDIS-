"use client";
import { Alert, Button } from "@/components/ui";

export default function GlobalError({ error, reset }) {
  const setup = /not configured/i.test(error?.message || "");
  return (
    <div className="mx-auto max-w-xl space-y-4 py-12">
      <Alert tone="error" title={setup ? "সেটআপ অসম্পূর্ণ · Setup incomplete" : "কিছু ভুল হয়েছে · Something went wrong"}>
        {setup ? error.message : "অনুগ্রহ করে আবার চেষ্টা করুন। Please try again."}
      </Alert>
      <Button onClick={reset}>আবার চেষ্টা করুন</Button>
    </div>
  );
}
