// Builds explainable warning / risk indicators from RPC results.
// DISPLAY ONLY in Stage 1: indicators inform people, they never approve or clear anything.
// levels: high (hold for review) | medium (needs attention) | info (context) | unknown (data gap, NOT clearance)
const ind = (code, level, bn, en, detail, source) => ({ code, level, bn, en, detail, source });

export function ownerIdentityIndicators(cmp) {
  if (!cmp) return [];
  const out = [];
  const src = "porcha owner vs NID record (ref.khatian_owners / ref.nid_persons)";
  if (cmp.outcome === "discrepancy_review") {
    const f = (x) => (x.score == null ? "n/a" : `${Math.round(x.score * 100)}%`);
    out.push(ind("NID_PORCHA_MISMATCH", "high", "NID ও পর্চার তথ্যে অমিল", "NID and porcha details do not meet the provisional 90% match",
      `Name ${f(cmp.name)}, father/spouse name ${f(cmp.father)}. Send to discrepancy review.`, src));
    if (cmp.bridgingAttestations.length)
      out.push(ind("ATTESTATION_BRIDGES", "info", "নামের অমিলের প্রত্যয়নপত্র আছে", "A name-attestation record references these spellings",
        `Attestation ${cmp.bridgingAttestations.map((a) => a.attestation_no).join(", ")} exists. It still needs human review.`, "ref.name_attestations"));
  } else if (cmp.outcome === "insufficient_data") {
    out.push(ind("IDENTITY_DATA_MISSING", "unknown", "তুলনার জন্য তথ্য অসম্পূর্ণ", "Not enough data to compare identity", "A name or father/spouse name is missing on one side.", src));
  } else {
    out.push(ind("IDENTITY_MATCH_PROVISIONAL", "info", "প্রাথমিক মিল পাওয়া গেছে", "Provisional match only",
      "Matching names do not prove legal ownership.", src));
  }
  return out;
}

export function khatianIndicators(res) {
  if (!res?.found) return [];
  const out = [];
  if (res.share_status !== "OK")
    out.push(ind("OWNER_SHARE_TOTAL", "medium", "মালিকদের অংশের যোগফল ১ নয়", "Recorded owner shares do not total 1", `Total = ${res.share_total}`, "ref.khatian_owners"));
  return out;
}

export function historyIndicators(h, remaining) {
  if (!h?.found) return [];
  const out = [];
  if (h.donor_previous_sales.length)
    out.push(ind("DONOR_PRIOR_SALES", "info", "দাতার পূর্ববর্তী বিক্রয় রেকর্ড আছে", "Donor has earlier sales on this dag",
      `${h.donor_previous_sales.length} deed(s), total ${h.donor_sold_total} শতক.`, "ref.deeds"));
  if (h.other_donor_deeds.length)
    out.push(ind("OTHER_DONOR_DEEDS", "medium", "একই দাগে অন্য দাতার দলিল আছে", "Other donors have deeds on this dag",
      "Not fraud by itself; check boundaries, shares and the baya chain.", "ref.deeds"));
  if (Number(h.all_sold_total_on_dag) - Number(h.dag.area) > 0.00005)
    out.push(ind("DAG_OVERSOLD", "high", "দাগের মোট পরিমাণের চেয়ে বেশি বিক্রয় রেকর্ড", "Recorded sales exceed the dag area",
      `Sold ${h.all_sold_total_on_dag} vs dag area ${h.dag.area} শতক.`, "ref.deeds / ref.khatian_dags"));
  if (remaining?.ok && remaining.overSoldAlready)
    out.push(ind("DONOR_ALREADY_OVER", "high", "দাতা প্রাপ্য অংশের বেশি বিক্রি করেছেন বলে রেকর্ড", "Donor's recorded sales exceed computed entitlement",
      `Entitled ${remaining.entitled}, sold ${remaining.soldByDonor} শতক.`, "computed (assumption-based)"));
  if (remaining?.ok && remaining.exceedsRemaining)
    out.push(ind("EXCEEDS_REMAINING", "high", "প্রস্তাবিত বিক্রয় অবশিষ্ট জমির চেয়ে বেশি", "Proposed sale exceeds remaining land",
      `Remaining ${remaining.remaining}, proposed ${remaining.selling} শতক.`, "computed (assumption-based)"));
  return out;
}

export function khasIndicators(k) {
  if (!k) return [];
  if (k.matches.length)
    return [ind("GOVT_INTEREST_MATCH", "high", "সরকারি স্বার্থের রেকর্ড পাওয়া গেছে — আটকে রাখুন", "Government-interest record found: hold for review",
      k.matches.map((m) => `${m.record_type} (dag ${m.dag_no}${m.agency ? ", " + m.agency : ""})`).join("; "), "ref.khas_govt")];
  return [ind("GOVT_NO_RECORD", "unknown", "সরবরাহকৃত ডেটাবেজে কোনো সরকারি স্বার্থের রেকর্ড পাওয়া যায়নি", "No record in the supplied database. This is NOT clearance.",
    "Absence of a record does not prove there is no government interest; full government records were not checked.", "ref.khas_govt")];
}

export function deedIndicators(r) {
  if (!r) return [];
  const out = [];
  if (r.candidates.length === 0)
    out.push(ind("DEED_NOT_FOUND", "unknown", "এই নম্বর ও তারিখে রেকর্ড পাওয়া যায়নি", "No record for this number and date in the supplied database", "Not found is not proof the deed is false.", "ref.deeds"));
  if (r.candidates.length > 1)
    out.push(ind("DEED_MULTIPLE", "high", "একই নম্বর ও তারিখে একাধিক রেকর্ড", "Several records share this number and date", "Possible conflicting records; review each.", "ref.deeds"));
  if (r.same_number_other_dates > 0)
    out.push(ind("DEED_NUMBER_OTHER_DATES", "info", "একই নম্বর অন্য তারিখেও আছে", "Same number exists on other dates", `${r.same_number_other_dates} other record(s). A number may legitimately repeat.`, "ref.deeds"));
  return out;
}

export function warishIndicators(w) {
  if (!w) return [];
  if (!w.found) return [ind("WARISH_NOT_FOUND", "unknown", "সার্টিফিকেট পাওয়া যায়নি", "Certificate not found in the supplied database", "Not found is not proof the certificate is false.", "ref.warish_certs")];
  const out = [];
  if (w.share_status !== "OK")
    out.push(ind("HEIR_SHARE_TOTAL", "medium", "ওয়ারিশদের অংশের যোগফল ১ নয়", "Heir shares do not total 1", `Total = ${w.share_total}`, "ref.warish_heirs"));
  return out;
}

export function challanIndicators(c) {
  if (!c) return [];
  const src = "ref.echallans";
  if (!c.found) return [ind("CHALLAN_NOT_FOUND", "high", "চালান পাওয়া যায়নি", "Challan not found", "Check the number; do not proceed.", src)];
  const out = [];
  if (!c.amount_matches) out.push(ind("CHALLAN_AMOUNT", "high", "চালানের পরিমাণ মেলেনি", "Amount does not match the record", "", src));
  if (!c.fee_type_matches) out.push(ind("CHALLAN_FEE_TYPE", "high", "ফি-এর ধরন মেলেনি", "Fee type does not match the record", "", src));
  if (c.verify_status !== "verified") out.push(ind("CHALLAN_UNVERIFIED", "medium", "চালান যাচাইকৃত নয়", "Record status is 'unverified'", "", src));
  if (c.already_linked_to_application) out.push(ind("CHALLAN_REUSED", "high", "চালান অন্য আবেদনে ব্যবহৃত", "Challan is already linked to another application", "", src));
  if (!out.length) out.push(ind("CHALLAN_RECORD_MATCH", "info", "রেকর্ডের সঙ্গে মিলেছে", "Matches the reference record",
    "A matching number and amount does not prove the money was actually paid; confirm with the official e-challan service.", src));
  return out;
}

export const LEVEL_ORDER = { high: 0, medium: 1, unknown: 2, info: 3 };
export const sortIndicators = (list) => [...list].sort((a, b) => LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level]);
