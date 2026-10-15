// Wizard step definitions + pure completion logic (unit-tested). The server (app.recompute) is the authority:
// `blockers` come from the database; this file only maps them to steps for navigation.
export const STEPS = [
  { n: 1, bn: "দাতা ও গ্রহীতা", en: "Donor & donee" },
  { n: 2, bn: "জমির তফসিল", en: "Land & khatian" },
  { n: 3, bn: "মালিকানার ভিত্তি", en: "Ownership basis" },
  { n: 4, bn: "দাগ ও পরিমাণ", en: "Dags & area" },
  { n: 5, bn: "শ্রেণি ও মূল্য", en: "Class & price" },
  { n: 6, bn: "ফি ও চালান", en: "Fees & challans" },
  { n: 7, bn: "সহায়ক নথি", en: "Documents" },
  { n: 8, bn: "বায়োমেট্রিক তারিখ", en: "Appointment" },
  { n: 9, bn: "পর্যালোচনা ও জমা", en: "Review & submit" },
];
export const LAST_STEP = STEPS.length;

export function stepDone(view, n) {
  if (!view?.application) return false;
  const a = view.application;
  const has = (s) => (a.blockers || []).some((b) => b.step === s);
  const plots = view.plots || [];
  switch (n) {
    case 1: return (view.parties || []).length === 2 && !has(1);
    case 2: return !!a.khatian_id && !has(2);
    case 3: return !!view.ownership && view.ownership.status !== "blocked" && !has(3);
    case 4: return plots.length > 0 && !has(4);
    case 5: return plots.length > 0 && plots.every((p) => p.land_class) && a.sale_price != null && !has(5);
    case 6: return (view.fee_items || []).length > 0 && !has(6);
    case 7: return true;                       // optional in Stage 2
    case 8: return !!view.appointment && !has(8);
    default: return false;
  }
}

// Highest step the user may open: first incomplete required step (all earlier steps stay reachable).
export function maxReachableStep(view) {
  for (let n = 1; n < LAST_STEP; n++) if (!stepDone(view, n)) return n;
  return LAST_STEP;
}
export const stepsNeedingAttention = (view) => [...new Set((view?.application?.blockers || []).map((b) => b.step))].sort((x, y) => x - y);
