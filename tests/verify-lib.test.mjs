import test from "node:test";
import assert from "node:assert/strict";
import { similarity, compareOwnerToPerson, MATCH_THRESHOLD } from "../lib/verify/matching.js";
import { computeRemaining } from "../lib/verify/remaining.js";
import { khasIndicators, challanIndicators, deedIndicators, historyIndicators } from "../lib/verify/risk.js";
import { bn2en } from "../lib/utils.js";

test("bn2en mirrors ref.bn2en", () => { assert.equal(bn2en(" ২২০ "), "220"); assert.equal(bn2en("৫০০১/২০২৩"), "5001/2023"); });
test("similarity basics", () => {
  assert.equal(similarity("করিম", "করিম"), 1);
  assert.equal(similarity("", "করিম"), null);
  assert.ok(similarity("শাখাওয়াত হোসেন", "শাখাওয়াত আক্তার") < MATCH_THRESHOLD);
  assert.equal(similarity("আব্দুল\u200c করিম", "আব্দুল করিম"), 1);
});
test("owner vs NID outcomes", () => {
  const ok = compareOwnerToPerson({ owner: { name: "রহিম উদ্দিন", father_name: "করিম মিয়া" }, person: { name: "রহিম উদ্দিন", father_name: "করিম মিয়া" } });
  assert.equal(ok.outcome, "meets_provisional_threshold");
  const bad = compareOwnerToPerson({ owner: { name: "রহিম উদ্দিন", father_name: "শাখাওয়াত হোসেন" }, person: { name: "রহিম উদ্দিন", father_name: "শাখাওয়াত আক্তার" },
    attestations: [{ attestation_no: "A-1", name_variant_a: "শাখাওয়াত হোসেন", name_variant_b: "শাখাওয়াত আক্তার" }] });
  assert.equal(bad.outcome, "discrepancy_review");
  assert.equal(bad.bridgingAttestations.length, 1);
  assert.equal(compareOwnerToPerson({ owner: { name: "ক", father_name: null }, person: { name: "ক", father_name: "খ" } }).outcome, "insufficient_data");
});
test("remaining land matches the documented example (2.50 - 1.00 = 1.50)", () => {
  const r = computeRemaining({ dagArea: 2.5, ownerShare: 1, soldByDonor: 1, selling: 1 });
  assert.equal(r.remaining, 1.5); assert.equal(r.afterSale, 0.5); assert.equal(r.exceedsRemaining, false);
  assert.equal(computeRemaining({ dagArea: 2.5, ownerShare: 1, soldByDonor: 1, selling: 1.6 }).exceedsRemaining, true);
  assert.equal(computeRemaining({ dagArea: 10, ownerShare: 0.25, soldByDonor: 0 }).entitled, 2.5);
  assert.equal(computeRemaining({ dagArea: 10, ownerShare: 0.5, heirShare: 0.5 }).entitled, 2.5);
  assert.equal(computeRemaining({ dagArea: 2, ownerShare: 1, soldByDonor: 3 }).overSoldAlready, true);
});
test("khas: no record is flagged unknown, never clearance", () => {
  const none = khasIndicators({ matches: [] })[0];
  assert.equal(none.level, "unknown"); assert.match(none.en, /NOT clearance/);
  assert.equal(khasIndicators({ matches: [{ record_type: "khas", dag_no: "5" }] })[0].level, "high");
});
test("challan indicators", () => {
  assert.equal(challanIndicators({ found: false })[0].code, "CHALLAN_NOT_FOUND");
  const codes = challanIndicators({ found: true, amount_matches: true, fee_type_matches: true, verify_status: "unverified", already_linked_to_application: true }).map((i) => i.code);
  assert.deepEqual(codes, ["CHALLAN_UNVERIFIED", "CHALLAN_REUSED"]);
  assert.equal(challanIndicators({ found: true, amount_matches: true, fee_type_matches: true, verify_status: "verified", already_linked_to_application: false })[0].level, "info");
});
test("deed and history indicators", () => {
  assert.equal(deedIndicators({ candidates: [1, 2].map(() => ({})), same_number_other_dates: 0 })[0].code, "DEED_MULTIPLE");
  assert.equal(deedIndicators({ candidates: [], same_number_other_dates: 0 })[0].level, "unknown");
  const h = { found: true, donor_previous_sales: [], donor_sold_total: 0, other_donor_deeds: [{}], all_sold_total_on_dag: 5, dag: { area: 3 } };
  const codes = historyIndicators(h, null).map((i) => i.code);
  assert.ok(codes.includes("OTHER_DONOR_DEEDS") && codes.includes("DAG_OVERSOLD"));
});
