// Remaining-land arithmetic. All areas in shotok (শতক).
// ASSUMPTION (unconfirmed by the owner): entitlement = dag.area x owner.share, share equal on every dag.
// Inheritance, purchase, partition, joint ownership and cancelled deeds are NOT yet modelled.
const TOL = 0.00005;
const r4 = (n) => Math.round(n * 10000) / 10000;

export const ENTITLEMENT_ASSUMPTIONS = [
  "Entitlement = dag area × recorded owner share (assumes the same share applies on every dag).",
  "Only earlier SALES by this person on this dag are subtracted; purchases, partition, cancelled deeds and joint-ownership changes are not modelled.",
];

export function computeRemaining({ dagArea, ownerShare, heirShare = null, soldByDonor = 0, selling = null }) {
  const area = Number(dagArea), share = Number(ownerShare), sold = Number(soldByDonor) || 0;
  if (![area, share].every(Number.isFinite)) return { ok: false, reason: "missing_inputs" };
  const heir = heirShare == null ? 1 : Number(heirShare);
  const entitled = r4(area * share * heir);
  const remaining = r4(entitled - sold);
  const out = {
    ok: true, entitled, soldByDonor: r4(sold), remaining,
    viaWarish: heirShare != null,
    assumptions: ENTITLEMENT_ASSUMPTIONS,
    overSoldAlready: remaining < -TOL,
  };
  if (selling != null && selling !== "" && Number.isFinite(Number(selling))) {
    const s = Number(selling);
    out.selling = s;
    out.afterSale = r4(remaining - s);
    out.exceedsRemaining = s - remaining > TOL;
  }
  return out;
}
