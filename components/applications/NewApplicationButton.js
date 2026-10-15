"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button } from "@/components/ui";
import { appCall } from "@/components/applications/api";

export default function NewApplicationButton({ children = "নতুন দলিলের আবেদন · Apply for Deed" }) {
  const router = useRouter(); const [busy, setBusy] = useState(false); const [error, setError] = useState(null);
  async function create() {
    setBusy(true); setError(null);
    const r = await appCall("create", {});
    if (r.error) { setBusy(false); setError(r.error); return; }
    router.push(`/dashboard/applications/${r.data.id}/edit`);
  }
  return <div className="space-y-2"><Button onClick={create} disabled={busy}>{busy ? "তৈরি হচ্ছে…" : children}</Button>{error && <Alert tone="error">{error}</Alert>}</div>;
}
