import test from "node:test";
import assert from "node:assert/strict";
import { ACTIONS, areaValue, moneyValue } from "../lib/applications/schemas.js";
import { STATUS, canEdit, canWithdraw, canChangeAppointment, statusMeta } from "../lib/applications/status.js";
import { stepDone, maxReachableStep, stepsNeedingAttention, STEPS, needsAttestation } from "../lib/applications/steps.js";

const U = "11111111-2222-4333-8444-555555555555";
const throws = (fn, re) => assert.throws(fn, re);

test("area/money parsing accepts Bangla digits and rejects junk", () => {
  assert.equal(areaValue("১.৫০"), 1.5); assert.equal(areaValue(""), null);
  throws(() => areaValue("0"), /greater than 0/); throws(() => areaValue("1.23456"), /decimals/); throws(() => areaValue("abc"), /number/);
  assert.equal(moneyValue("১,০০,০০০"), 100000); throws(() => moneyValue("-5"), /number/); throws(() => moneyValue("1.234"), /decimals/);
});
test("every action validates its input before touching the database", () => {
  assert.deepEqual(ACTIONS.create.parse({}), {});
  throws(() => ACTIONS.get.parse({}), /application is required/); throws(() => ACTIONS.get.parse({ app_id: "x" }), /must be an id/);
  assert.equal(ACTIONS.get.parse({ app_id: U }).p_app, U);
  throws(() => ACTIONS.party.parse({ app_id: U, role: "admin", nid_no: "1234567890", dob: "1990-01-01" }), /invalid format/);
  assert.equal(ACTIONS.party.parse({ app_id: U, role: "donor", nid_no: "১২৩৪৫৬৭৮৯০", dob: "1990-01-01" }).p_role, "donor");
  throws(() => ACTIONS.ownership.parse({ app_id: U, route: "record_owner" }), /owner is required/);
  assert.equal(ACTIONS.ownership.parse({ app_id: U, route: "baya_deed", deed_no: "৫০০১/২০২৩", deed_date: "2023-05-01" }).p_owner_id, null);
  throws(() => ACTIONS.ownership.parse({ app_id: U, route: "hack", owner_id: U }), /invalid format/);
  const p = ACTIONS.plots.parse({ app_id: U, plots: [{ dag_id: U, area_sold: "১.৫" }, { dag_id: U, area_sold: "" }] });
  assert.equal(p.p_plots[0].area_sold, 1.5); assert.equal(p.p_plots[1].area_sold, null);
  throws(() => ACTIONS.plots.parse({ app_id: U, plots: [] }), /1 to 10/); throws(() => ACTIONS.plots.parse({ app_id: U, plots: new Array(11).fill({ dag_id: U }) }), /1 to 10/);
  throws(() => ACTIONS.challan.parse({ app_id: U, challan_type: "stamp", challan_no: "a b", amount: 5 }), /invalid format/);
  assert.equal(ACTIONS.challan.parse({ app_id: U, challan_type: "stamp", challan_no: "CH-0001", amount: "1,500" }).p_amount, 1500);
  assert.equal(ACTIONS.submit.parse({ app_id: U, accept: "true" }).p_accept, false);   // only boolean true counts
  assert.equal(ACTIONS.submit.parse({ app_id: U, accept: true }).p_accept, true);
  throws(() => ACTIONS["appointment-book"].parse({ app_id: U, date: "2026-11-01", slot: "10am" }), /invalid format/);
  assert.equal(ACTIONS["notifications-read"].parse({}).p_ids, null);
});
test("the client cannot supply derived values (no entitlement/fee/status/flag fields are parsed)", () => {
  const forbidden = /entitled|remaining|flags|blockers|fee_total|status|amount_due/;
  const probe = ACTIONS.plots.parse({ app_id: U, plots: [{ dag_id: U, area_sold: 1, entitled: 99, remaining: 99 }], status: "registered" });
  assert.ok(!forbidden.test(JSON.stringify(probe)));
  assert.ok(!forbidden.test(JSON.stringify(ACTIONS.details.parse({ app_id: U, details: [{ dag_id: U, land_class: "নাল" }], price: 100, fee_total: 1, status: "registered" }))));
});
test("status rules for users", () => {
  assert.ok(canEdit("draft") && canEdit("correction_requested"));
  for (const s of ["submitted", "discrepancy_review", "under_review", "registered", "rejected", "withdrawn"]) assert.equal(canEdit(s), false, s);
  assert.ok(canWithdraw("submitted") && !canWithdraw("under_review") && !canWithdraw("registered"));
  assert.ok(canChangeAppointment("draft") && !canChangeAppointment("registered"));
  for (const s of Object.keys(STATUS)) assert.ok(statusMeta(s).bn && statusMeta(s).explainEn, s);
  assert.equal(statusMeta("weird").en, "weird");
});
const base = () => ({ application: { khatian_id: null, sale_price: null, blockers: [] }, parties: [], ownership: null, plots: [], fee_items: [], challans: [], appointment: null });
test("attestation gate applies to a mid-range father-name match as well", () => {
  const v = base();
  v.parties = [{ role: "donor" }, { role: "donee" }];
  v.application.khatian_id = "k";
  v.ownership = { route: "record_owner", status: "review", name_score: 0.96, father_score: 0.68 };
  assert.equal(needsAttestation(v), true);
  assert.equal(stepDone(v, 3), false);
  assert.equal(maxReachableStep(v), 3);
  v.identity_evidence = { attestation_verified: true };
  assert.equal(stepDone(v, 3), true);
  assert.equal(maxReachableStep(v), 4); // the ownership step unlocks; plots are the next incomplete step
});

test("step completion and navigation gating", () => {
  const v = base(); assert.equal(maxReachableStep(v), 1);
  v.parties = [{}, {}]; assert.equal(stepDone(v, 1), true); assert.equal(maxReachableStep(v), 2);
  v.application.khatian_id = "k"; v.ownership = { status: "review" }; v.plots = [{ land_class: "নাল" }]; v.application.sale_price = 100;
  assert.equal(maxReachableStep(v), 6);                         // fees step incomplete
  v.fee_items = [{}]; assert.equal(maxReachableStep(v), 8);     // documents optional; appointment missing
  v.appointment = { id: "a" }; assert.equal(maxReachableStep(v), 9);
  v.ownership = { status: "blocked" }; assert.equal(stepDone(v, 3), false);
  v.ownership = { status: "provisional" }; v.application.blockers = [{ step: 4, code: "EXCEEDS_REMAINING" }];
  assert.equal(stepDone(v, 4), false); assert.deepEqual(stepsNeedingAttention(v), [4]); assert.equal(STEPS.length, 9);
});
