"use client";
import { useState } from "react";
import { Alert, Button, Card, DataTable, Field, Input, Select } from "@/components/ui";
import { createClient } from "@/lib/supabase/browser";
import { DOC_TYPES } from "@/lib/applications/status";

const OK = ["application/pdf", "image/jpeg", "image/png"]; const MAX = 5 * 1024 * 1024;

export default function StepDocuments({ view, call, busy: parentBusy }) {
  const [type, setType] = useState("porcha_copy"); const [file, setFile] = useState(null); const [msg, setMsg] = useState(null); const [up, setUp] = useState(false);
  const busy = parentBusy || up;

  async function upload(e) {
    e.preventDefault(); setMsg(null);
    if (!file) return;
    if (!OK.includes(file.type)) return setMsg("শুধু PDF, JPG বা PNG। Only PDF, JPG or PNG files.");
    if (file.size > MAX) return setMsg("ফাইল ৫ MB-এর বেশি হতে পারবে না। Max 5 MB.");
    setUp(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { window.location.href = "/login"; return; }
      const safe = file.name.replace(/[^A-Za-z0-9._-]/g, "_").slice(-80);
      const path = `${user.id}/${view.application.id}/${crypto.randomUUID()}-${safe}`;
      const { error } = await supabase.storage.from("application-docs").upload(path, file, { contentType: file.type, upsert: false });
      if (error) { setMsg("আপলোড ব্যর্থ। Upload failed. (Is the 07 migration / storage bucket installed?)"); return; }
      const r = await call("document-register", { doc_type: type, path, file_name: file.name, mime_type: file.type, size_bytes: file.size });
      if (r.error) { await supabase.storage.from("application-docs").remove([path]); return; }
      setFile(null); e.target.reset();
    } finally { setUp(false); }
  }
  async function remove(d) {
    const r = await call("document-delete", { doc_id: d.id });
    if (!r.error && r.data?.storage_path) await createClient().storage.from("application-docs").remove([r.data.storage_path]);
  }
  return (
    <div className="space-y-4">
      <Alert tone="info">সহায়ক নথি ঐচ্ছিক (সর্বোচ্চ ১০টি, প্রতিটি ৫ MB; PDF/JPG/PNG)। নথিগুলো ব্যক্তিগত স্টোরেজে থাকে। সাব-রেজিস্ট্রারের দেখার অনুমতি Stage 3-এ যুক্ত হবে। Optional; reviewer access is a Stage 3 task.</Alert>
      <Card title="নথি আপলোড · Upload a document">
        <form onSubmit={upload} className="grid gap-4 sm:grid-cols-[1fr,1fr,auto] sm:items-end">
          <Field label="ধরন · Type" htmlFor="d-type"><Select id="d-type" value={type} onChange={(e) => setType(e.target.value)}>{Object.entries(DOC_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></Field>
          <Field label="ফাইল · File" htmlFor="d-file"><Input id="d-file" type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={(e) => setFile(e.target.files?.[0] || null)} /></Field>
          <Button type="submit" disabled={busy || !file}>{up ? "আপলোড হচ্ছে…" : "আপলোড"}</Button>
        </form>
        {msg && <div className="mt-3"><Alert tone="error">{msg}</Alert></div>}
      </Card>
      <DataTable caption="Documents" empty="কোনো নথি যুক্ত করা হয়নি" rows={view.documents || []} columns={[
        { key: "doc_type", label: "ধরন", render: (r) => DOC_TYPES[r.doc_type] || r.doc_type }, { key: "file_name", label: "ফাইল" },
        { key: "size_bytes", label: "আকার", render: (r) => `${Math.ceil(r.size_bytes / 1024)} KB` },
        { key: "id", label: "", render: (r) => <Button variant="ghost" disabled={busy} onClick={() => remove(r)}>মুছুন</Button> }]} />
    </div>
  );
}
