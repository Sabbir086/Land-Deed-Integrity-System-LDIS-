"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Alert, Badge, Button, Card, DataTable, Field, Input, Select, Spinner } from "@/components/ui";
import LocationPicker from "./LocationPicker";
import IdentityFields from "./IdentityFields";
import Indicators from "./Indicators";
import { callApi, useLookup } from "./api";
import { fmtArea, fmtDate } from "@/lib/utils";

const pct = (s) => (s == null ? "n/a" : `${Math.round(s * 100)}%`);
const OUTCOME = {
  meets_provisional_threshold: ["green", "প্রাথমিক সীমা (৯০%) পূরণ — আইনগত প্রমাণ নয়"],
  discrepancy_review: ["red", "অসংগতি যাচাইয়ে পাঠাতে হবে"],
  insufficient_data: ["purple", "তুলনার তথ্য অপর্যাপ্ত"],
};

export default function LandWorkbench() {
  const [loc, setLoc] = useState({});
  const [types, setTypes] = useState([]);
  const [type, setType] = useState("");
  const [kno, setKno] = useState("");
  const [searchBy, setSearchBy] = useState("khatian");
  const [selectedKhatian, setSelectedKhatian] = useState(null);
  const [owner, setOwner] = useState(null);
  const [dagIds, setDagIds] = useState([]);
  const [nid, setNid] = useState(""); const [dob, setDob] = useState("");
  const [histDag, setHistDag] = useState(""); const [selling, setSelling] = useState("");
  const [locErr, setLocErr] = useState(null);

  const [kh, runKh, resetKh] = useLookup();
  const [idc, runId, resetId] = useLookup();
  const [hist, runHist, resetHist] = useLookup();
  const [khas, runKhas, resetKhas] = useLookup();

  const found = selectedKhatian || (kh.data?.found ? kh.data : null);

  useEffect(() => {
    setTypes([]); setType("");
    if (!loc.location_id) return;
    callApi("/api/verify/khatian-types", { location_id: loc.location_id }).then((r) => { if (!r.error) setTypes(r.data); else setLocErr(r.error); });
  }, [loc.location_id]);

  function resetAll() { setOwner(null); setDagIds([]); resetId(); resetHist(); resetKhas(); setHistDag(""); }
  function searchKhatian(e) {
    e.preventDefault();
    resetAll();
    setSelectedKhatian(null);
    if (searchBy === "dag") {
      runKh("/api/verify/khatian-by-dag", { location_id: loc.location_id, khatian_type: type, dag_no: kno });
    } else {
      runKh("/api/verify/khatian", { location_id: loc.location_id, khatian_type: type, khatian_no: kno });
    }
  }

  const selectedDags = useMemo(() => (found ? found.dags.filter((d) => dagIds.includes(d.id)) : []), [found, dagIds]);
  const toggleDag = (id) => setDagIds((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  const all = useMemo(() => [selectedKhatian?.indicators || kh.data?.indicators, idc.data?.indicators, hist.data?.indicators, khas.data?.indicators].flat().filter(Boolean), [kh.data, selectedKhatian, idc.data, hist.data, khas.data]);
  const order = { high: 0, medium: 1, unknown: 2, info: 3 };
  const merged = [...all].sort((a, b) => order[a.level] - order[b.level]);

  return (
    <div className="space-y-6">
      <Card title="ধাপ ১ — জমির তফসিল" subtitle="বিভাগ → জেলা → উপজেলা → মৌজা → খতিয়ানের ধরন → খতিয়ান অথবা দাগ নম্বর">
        <form onSubmit={searchKhatian} className="space-y-4">
          <LocationPicker onChange={setLoc} onError={setLocErr} />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:items-end">
            <Field label="খতিয়ানের ধরন" htmlFor="k-type">
              <Select id="k-type" value={type} onChange={(e) => setType(e.target.value)} disabled={!types.length}><option value="">— নির্বাচন —</option>{types.map((t) => <option key={t}>{t}</option>)}</Select>
            </Field>
            <Field label="কোন নম্বর দিয়ে খুঁজবেন?" htmlFor="search-by">
              <Select id="search-by" value={searchBy} onChange={(e) => { setSearchBy(e.target.value); setKno(""); setSelectedKhatian(null); resetKh(); resetAll(); }}>
                <option value="khatian">খতিয়ান নম্বর</option><option value="dag">দাগ নম্বর</option>
              </Select>
            </Field>
            <Field label={searchBy === "dag" ? "দাগ নম্বর" : "খতিয়ান নম্বর"} htmlFor="k-no">
              <Input id="k-no" inputMode="numeric" value={kno} onChange={(e) => setKno(e.target.value)} />
            </Field>
            <Button type="submit" disabled={kh.loading || !loc.location_id || !type || !kno}>রেকর্ড খুঁজুন</Button>
          </div>
          {locErr && <Alert tone="error">{locErr}</Alert>}
          {kh.loading && <Spinner />}
        </form>
      </Card>

      {kh.error && <Alert tone="error">{kh.error}</Alert>}
      {kh.data && !kh.data.found && !kh.data.candidates?.length && <Alert tone="warn" title="পর্চা পাওয়া যায়নি">নির্বাচিত মৌজা, ধরন ও নম্বরে সরবরাহকৃত ডেটাবেজে খতিয়ান/দাগের মিল নেই। এটি প্রমাণ নয় যে বাস্তবে রেকর্ড নেই।</Alert>}

      {kh.data?.candidates?.length > 1 && !selectedKhatian && (
        <Card title="একই দাগ একাধিক খতিয়ানে পাওয়া গেছে" subtitle="সঠিক খতিয়ানটি নির্বাচন করুন, তারপর মালিক ও দাগের যাচাই চালিয়ে যান।">
          <div className="grid gap-3 sm:grid-cols-2">
            {kh.data.candidates.map((candidate) => (
              <button key={candidate.khatian.id} type="button" onClick={() => { setSelectedKhatian(candidate); setOwner(null); setDagIds([]); resetId(); resetHist(); resetKhas(); setHistDag(""); }} className="rounded-lg border p-4 text-left hover:border-emerald-700 hover:bg-emerald-50">
                <span className="block font-semibold">খতিয়ান {candidate.khatian.khatian_no} · {candidate.khatian.khatian_type}</span>
                <span className="mt-1 block text-sm text-slate-600">{candidate.khatian.mouza}, {candidate.khatian.upazila}, {candidate.khatian.district}</span>
                <span className="mt-1 block text-xs text-slate-500">মালিক: {candidate.owners.length} · দাগ: {candidate.dags.length}</span>
              </button>
            ))}
          </div>
        </Card>
      )}

      {found && (
        <>
          <Card title={`খতিয়ান ${found.khatian.khatian_no} (${found.khatian.khatian_type})`} subtitle={`${found.khatian.mouza}, ${found.khatian.upazila}, ${found.khatian.district}, ${found.khatian.division} · Source: ref.khatians`}>
            <h3 className="mb-2 text-sm font-semibold">রেকর্ডীয় মালিক <Badge tone={found.share_status === "OK" ? "green" : "amber"}>অংশের যোগফল {found.share_total}</Badge></h3>
            <p className="mb-2 text-xs text-slate-500">যাঁর কাছ থেকে জমি কিনতে চান তাঁকে নির্বাচন করুন।</p>
            <div role="radiogroup" aria-label="Record owner" className="overflow-x-auto rounded-md border border-slate-200">
              <table className="min-w-full text-sm"><thead className="bg-slate-50"><tr>{["", "ক্রম", "মালিকের নাম", "পিতা/স্বামী", "অংশ"].map((h) => <th key={h} className="px-3 py-2 text-left font-semibold">{h}</th>)}</tr></thead>
                <tbody className="divide-y divide-slate-100">{found.owners.map((o) => (
                  <tr key={o.id}><td className="px-3 py-2"><input type="radio" name="owner" aria-label={`Select ${o.owner_name}`} checked={owner?.id === o.id} onChange={() => { setOwner(o); resetId(); resetHist(); }} /></td>
                    <td className="px-3 py-2">{o.serial}</td><td className="px-3 py-2 font-medium">{o.owner_name}</td><td className="px-3 py-2">{o.father_name || "—"}</td><td className="px-3 py-2">{o.share}</td></tr>))}</tbody></table>
            </div>
            <h3 className="mb-2 mt-5 text-sm font-semibold">দাগসমূহ</h3>
            <div className="overflow-x-auto rounded-md border border-slate-200">
              <table className="min-w-full text-sm"><thead className="bg-slate-50"><tr>{["", "ক্রম", "দাগ নং", "জমির শ্রেণি", "পরিমাণ", "নির্বাচিত মালিকের প্রাপ্য*"].map((h) => <th key={h} className="px-3 py-2 text-left font-semibold">{h}</th>)}</tr></thead>
                <tbody className="divide-y divide-slate-100">{found.dags.map((d) => (
                  <tr key={d.id}><td className="px-3 py-2"><input type="checkbox" aria-label={`Select dag ${d.dag_no}`} checked={dagIds.includes(d.id)} onChange={() => { toggleDag(d.id); resetHist(); resetKhas(); }} /></td>
                    <td className="px-3 py-2">{d.serial}</td><td className="px-3 py-2 font-medium">{d.dag_no}</td><td className="px-3 py-2">{d.land_class || "—"}</td><td className="px-3 py-2">{fmtArea(d.area)}</td>
                    <td className="px-3 py-2">{owner ? fmtArea(Math.round(d.area * owner.share * 10000) / 10000) : "—"}</td></tr>))}</tbody></table>
            </div>
            <p className="mt-2 text-xs text-slate-500">* অনুমান: প্রাপ্য = দাগের পরিমাণ × মালিকের অংশ (প্রতিটি দাগে একই অংশ ধরে)। এটি এখনো নিশ্চিত নিয়ম নয়।</p>
            <div className="mt-4"><Indicators items={found.indicators || kh.data.indicators} /></div>
          </Card>

          <Card title="ধাপ ২ — রেকর্ডীয় মালিক বনাম NID" subtitle="নির্বাচিত মালিকের পর্চা-তথ্য NID রেকর্ডের সঙ্গে তুলনা (প্রস্তাবিত ৯০% নিয়ম)">
            {!owner ? <p className="text-sm text-slate-500">আগে উপরে একজন মালিক নির্বাচন করুন।</p> : (
              <form onSubmit={(e) => { e.preventDefault(); runId("/api/verify/owner-check", { owner_id: owner.id, nid_no: nid, dob }); }} className="space-y-4">
                <p className="text-sm">নির্বাচিত: <strong>{owner.owner_name}</strong> — এই ব্যক্তির NID নম্বর ও জন্মতারিখ দিন।</p>
                <IdentityFields nid={nid} dob={dob} onNid={setNid} onDob={setDob} idPrefix="donor" />
                <Button type="submit" disabled={idc.loading || !nid || !dob}>তুলনা করুন</Button>
                {idc.loading && <Spinner />}
              </form>
            )}
            {idc.error && <div className="mt-3"><Alert tone="error">{idc.error}</Alert></div>}
            {idc.data && !idc.data.found && <div className="mt-3"><Alert tone="warn" title="NID রেকর্ড পাওয়া যায়নি">এই NID ও জন্মতারিখে প্রকল্পের ডেটাবেজে রেকর্ড নেই।</Alert></div>}
            {idc.data?.found && (
              <div className="mt-4 space-y-3">
                <Badge tone={OUTCOME[idc.data.comparison.outcome][0]}>{OUTCOME[idc.data.comparison.outcome][1]}</Badge>
                <DataTable caption="Field comparison" rows={[
                  { id: "n", f: "নাম", a: idc.data.comparison.name.a, b: idc.data.comparison.name.b, s: idc.data.comparison.name.score },
                  { id: "f", f: "পিতা/স্বামীর নাম", a: idc.data.comparison.father.a, b: idc.data.comparison.father.b, s: idc.data.comparison.father.score }]}
                  columns={[{ key: "f", label: "ফিল্ড" }, { key: "a", label: "পর্চা" }, { key: "b", label: "NID" }, { key: "s", label: "মিল", render: (r) => pct(r.s) }]} />
                <Indicators items={idc.data.indicators} />
                <p className="text-xs text-slate-500">বায়া দলিল / ওয়ারিশ সূত্রের যাচাই: <Link className="underline" href="/verify/warish">ওয়ারিশ</Link> ও <Link className="underline" href="/verify/deed">দলিল</Link> পৃষ্ঠা ব্যবহার করুন। সংযুক্ত ওয়ার্কফ্লো Stage 2-এর কাজ।</p>
              </div>
            )}
          </Card>

          <Card title="ধাপ ৩ — পূর্ববর্তী বিক্রয় ও অবশিষ্ট জমি" subtitle="নির্বাচিত দাগে দাতার ও অন্যদের দলিল · Source: ref.deeds (location + খতিয়ান + দাগ, normalised)">
            {!owner || selectedDags.length === 0 ? <p className="text-sm text-slate-500">মালিক ও অন্তত একটি দাগ নির্বাচন করুন। দাতার NID ও জন্মতারিখ ধাপ ২-এর ঘর থেকে নেওয়া হবে।</p> : (
              <form onSubmit={(e) => { e.preventDefault(); runHist("/api/verify/dag-history", { khatian_id: found.khatian.id, dag_id: histDag || selectedDags[0].id, owner_id: owner.id, nid_no: nid, dob, selling: selling || null }); }} className="grid gap-4 sm:grid-cols-4 sm:items-end">
                <Field label="কোন দাগ" htmlFor="h-dag"><Select id="h-dag" value={histDag || selectedDags[0].id} onChange={(e) => setHistDag(e.target.value)}>{selectedDags.map((d) => <option key={d.id} value={d.id}>দাগ {d.dag_no}</option>)}</Select></Field>
                <Field label="বিক্রি করতে চান (শতক)" htmlFor="h-sell" hint="ঐচ্ছিক"><Input id="h-sell" type="number" step="0.0001" min="0" value={selling} onChange={(e) => setSelling(e.target.value)} /></Field>
                <Button type="submit" disabled={hist.loading || !nid || !dob}>ইতিহাস দেখুন</Button>
                {hist.loading && <Spinner />}
              </form>
            )}
            {hist.error && <div className="mt-3"><Alert tone="error">{hist.error}</Alert></div>}
            {hist.data && !hist.data.found && <div className="mt-3"><Alert tone="warn">{hist.data.reason === "person_not_found" ? "দাতার NID রেকর্ড পাওয়া যায়নি।" : "দাগ পাওয়া যায়নি।"}</Alert></div>}
            {hist.data?.found && (() => { const h = hist.data, r = h.remaining; return (
              <div className="mt-4 space-y-4">
                <div className="grid gap-4 lg:grid-cols-2">
                  <div><h3 className="mb-2 text-sm font-semibold">বাম: বর্তমান দাতার পূর্ববর্তী বিক্রয়</h3>
                    <DataTable caption="Donor earlier sales" rows={h.donor_previous_sales} empty="এই দাগে দাতার কোনো পূর্ববর্তী বিক্রয়ের রেকর্ড নেই"
                      columns={[{ key: "deed_no", label: "দলিল" }, { key: "deed_date", label: "তারিখ", render: (x) => fmtDate(x.deed_date) }, { key: "area_sold", label: "বিক্রিত", render: (x) => fmtArea(x.area_sold) }, { key: "donee_name", label: "গ্রহীতা" }]} /></div>
                  <div><h3 className="mb-2 text-sm font-semibold">ডান: অন্য দাতাদের দলিল (একই দাগ)</h3>
                    <DataTable caption="Other donors" rows={h.other_donor_deeds} empty="অন্য কোনো দাতার রেকর্ড নেই"
                      columns={[{ key: "deed_no", label: "দলিল" }, { key: "deed_date", label: "তারিখ", render: (x) => fmtDate(x.deed_date) }, { key: "donor_name", label: "দাতা" }, { key: "area_sold", label: "বিক্রিত", render: (x) => fmtArea(x.area_sold) }]} /></div>
                </div>
                {r?.ok && (
                  <div><h3 className="mb-2 text-sm font-semibold">অবশিষ্ট জমির হিসাব <Badge tone="amber">অনুমান-ভিত্তিক · Indicative</Badge></h3>
                    <DataTable caption="Remaining land" rows={[{ id: 1, a: fmtArea(r.entitled), b: fmtArea(r.soldByDonor), c: fmtArea(r.remaining), d: r.selling != null ? fmtArea(r.selling) : "—", e: r.afterSale != null ? fmtArea(r.afterSale) : "—" }]}
                      columns={[{ key: "a", label: "প্রাপ্য" }, { key: "b", label: "পূর্বে বিক্রি" }, { key: "c", label: "অবশিষ্ট" }, { key: "d", label: "নতুন বিক্রি" }, { key: "e", label: "বিক্রির পরে" }]} />
                    <ul className="mt-2 list-disc pl-5 text-xs text-slate-500">{r.assumptions.map((a) => <li key={a}>{a}</li>)}</ul></div>)}
                {h.donor_purchases.length > 0 && <Alert tone="info">এই ব্যক্তি এই দাগে {h.donor_purchases.length}টি দলিলে গ্রহীতা (ক্রয়) — এগুলো হিসাবে ধরা হয়নি।</Alert>}
                <Indicators items={h.indicators} />
              </div>); })()}
          </Card>

          <Card title="ধাপ ৪ — খাস জমি ও সরকারি স্বার্থ" subtitle="নির্বাচিত দাগগুলো · Source: ref.khas_govt">
            <Button disabled={khas.loading || selectedDags.length === 0} onClick={() => runKhas("/api/verify/khas", { location_id: found.khatian.location_id, khatian_no: found.khatian.khatian_no, dag_nos: selectedDags.map((d) => d.dag_no) })}>সরকারি স্বার্থ যাচাই</Button>
            {selectedDags.length === 0 && <span className="ml-3 text-sm text-slate-500">অন্তত একটি দাগ নির্বাচন করুন।</span>}
            {khas.loading && <span className="ml-3"><Spinner /></span>}
            {khas.error && <div className="mt-3"><Alert tone="error">{khas.error}</Alert></div>}
            {khas.data && (
              <div className="mt-4 space-y-3">
                {khas.data.matches.length > 0 && <DataTable caption="Government interest" rows={khas.data.matches} columns={[{ key: "record_type", label: "ধরন" }, { key: "dag_no", label: "দাগ" }, { key: "area", label: "পরিমাণ", render: (x) => fmtArea(x.area) }, { key: "agency", label: "সংস্থা" }, { key: "reference_note", label: "রেফারেন্স" }]} />}
                <Indicators items={khas.data.indicators} />
              </div>)}
          </Card>

          <Card title="সারসংক্ষেপ — সব সতর্কতা" subtitle="Combined view of indicators above (display only; nothing here approves or clears the land)">
            {merged.length ? <Indicators items={merged} title="সব সূচক" /> : <p className="text-sm text-slate-500">এখনো কোনো যাচাই চালানো হয়নি।</p>}
          </Card>
        </>
      )}
    </div>
  );
}
