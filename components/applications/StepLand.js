"use client";
import { useEffect, useState } from "react";
import { Alert, Button, Card, DataTable, Field, Input, Select } from "@/components/ui";
import LocationPicker from "@/components/verify/LocationPicker";
import { callApi } from "@/components/verify/api";
import { fmtArea } from "@/lib/utils";

export default function StepLand({ view, call, busy }) {
  const a = view.application;
  const [changing, setChanging] = useState(!a.khatian_id);
  const [loc, setLoc] = useState({}); const [types, setTypes] = useState([]); const [type, setType] = useState(""); const [kno, setKno] = useState("");
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    setTypes([]); setType("");
    if (!loc.location_id) return;
    callApi("/api/verify/khatian-types", { location_id: loc.location_id }).then((r) => (r.error ? setMsg({ tone: "error", text: r.error }) : setTypes(r.data)));
  }, [loc.location_id]);

  async function search(e) {
    e.preventDefault(); setMsg(null);
    const r = await call("land", { location_id: loc.location_id, khatian_type: type, khatian_no: kno });
    if (r.error) return;
    if (r.data?.found === false) { setMsg({ tone: "warn", text: "এই মৌজা, ধরন ও নম্বরে কোনো খতিয়ান পাওয়া যায়নি। রেকর্ড না পাওয়া মানে এটি ভুয়া—এমন নয়। No khatian found in the supplied database." }); return; }
    setChanging(false);
  }
  const kh = view.khatian;
  return (
    <div className="space-y-4">
      {a.khatian_id && (
        <Card title="নির্বাচিত খতিয়ান · Selected khatian" actions={!changing && <Button variant="secondary" onClick={() => setChanging(true)} disabled={busy}>পরিবর্তন · Change</Button>}>
          <p className="text-sm">{a.division} › {a.district} › {a.upazila} › {a.mouza} — <span className="font-semibold">{a.khatian_type} খতিয়ান {a.khatian_no}</span></p>
          {kh && (
            <div className="mt-3 grid gap-4 lg:grid-cols-2">
              <DataTable caption="Owners" columns={[{ key: "serial", label: "#" }, { key: "owner_name", label: "মালিক" }, { key: "father_name", label: "পিতা/স্বামী" }, { key: "share", label: "অংশ" }]} rows={kh.owners} />
              <DataTable caption="Dags" columns={[{ key: "dag_no", label: "দাগ" }, { key: "land_class", label: "শ্রেণি" }, { key: "area", label: "পরিমাণ", render: (r) => fmtArea(r.area) }]} rows={kh.dags} />
            </div>
          )}
        </Card>
      )}
      {changing && (
        <Card title="জমির তফসিল খুঁজুন · Find the khatian">
          {a.khatian_id && <div className="mb-3"><Alert tone="warn">খতিয়ান বদলালে মালিকানার ভিত্তি ও নির্বাচিত দাগ মুছে যাবে। Changing the khatian clears the ownership basis and dag selection.</Alert></div>}
          <form onSubmit={search} className="space-y-4">
            <LocationPicker onChange={setLoc} onError={(t) => setMsg({ tone: "error", text: t })} />
            <div className="grid gap-4 sm:grid-cols-3 sm:items-end">
              <Field label="খতিয়ানের ধরন · Type" htmlFor="l-type"><Select id="l-type" value={type} onChange={(e) => setType(e.target.value)} disabled={!types.length}><option value="">— নির্বাচন —</option>{types.map((t) => <option key={t}>{t}</option>)}</Select></Field>
              <Field label="খতিয়ান নম্বর · Number" htmlFor="l-no"><Input id="l-no" inputMode="numeric" value={kno} onChange={(e) => setKno(e.target.value)} /></Field>
              <div className="flex gap-2"><Button type="submit" disabled={busy || !loc.location_id || !type || !kno}>{busy ? "খোঁজা হচ্ছে…" : "খুঁজুন · Search"}</Button>{a.khatian_id && <Button type="button" variant="ghost" onClick={() => setChanging(false)}>বাতিল</Button>}</div>
            </div>
          </form>
        </Card>
      )}
      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
    </div>
  );
}
