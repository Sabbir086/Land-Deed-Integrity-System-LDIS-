"use client";
import { useEffect, useState } from "react";
import { Field, Select } from "@/components/ui";
import { callApi } from "./api";

// division > district > upazila > mouza. Emits { division, district, upazila, location_id, mouza } (location_id set when mouza chosen).
export default function LocationPicker({ onChange, onError }) {
  const [sel, setSel] = useState({ division: "", district: "", upazila: "", mouza: "", mouzaId: "" });
  const [opts, setOpts] = useState({ division: [], district: [], upazila: [], mouza: [] });
  const [loading, setLoading] = useState("");

  async function load(level, parents) {
    setLoading(level);
    const r = await callApi("/api/verify/locations", { level, ...parents });
    setLoading("");
    if (r.error) { onError?.(r.error); return; }
    setOpts((o) => ({ ...o, [level]: r.data }));
  }
  useEffect(() => { load("division", {}); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  function pick(level, value) {
    const order = ["division", "district", "upazila", "mouza"];
    const next = { ...sel };
    order.slice(order.indexOf(level)).forEach((l) => (next[l] = ""));
    next[level] = level === "mouza"
      ? (opts.mouza.find((m) => String(m.id) === String(value))?.name || "")
      : value;
    if (level === "mouza") next.mouzaId = value;
    else next.mouzaId = "";
    setSel(next);
    setOpts((o) => { const c = { ...o }; order.slice(order.indexOf(level) + 1).forEach((l) => (c[l] = [])); return c; });
    const child = order[order.indexOf(level) + 1];
    if (value && child) load(child, { division: next.division, district: next.district, upazila: next.upazila });
    const mouzaObj = level === "mouza" ? opts.mouza.find((m) => String(m.id) === String(value)) : null;
    onChange({ ...next, location_id: mouzaObj ? mouzaObj.id : null, mouza: mouzaObj ? mouzaObj.name : "" });
  }

  const sels = [
    ["division", "বিভাগ · Division", opts.division], ["district", "জেলা · District", opts.district],
    ["upazila", "উপজেলা · Upazila", opts.upazila], ["mouza", "মৌজা · Mouza", opts.mouza],
  ];
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {sels.map(([level, label, list], idx) => {
        const parentChosen = idx === 0 || sel[sels[idx - 1][0]];
        return (
          <Field key={level} label={label} htmlFor={`loc-${level}`} hint={loading === level ? "লোড হচ্ছে…" : undefined}>
            <Select id={`loc-${level}`} value={level === "mouza" ? sel.mouzaId : sel[level]}
              disabled={!parentChosen || list.length === 0} onChange={(e) => pick(level, e.target.value)}>
              <option value="">— নির্বাচন করুন —</option>
              {list.map((o) => (typeof o === "string" ? <option key={o} value={o}>{o}</option> : <option key={o.id} value={o.id}>{o.name}</option>))}
            </Select>
          </Field>
        );
      })}
    </div>
  );
}
