import { verifyRoute } from "@/lib/api";
import { uuid, nid, dob, optionalPositive } from "@/lib/verify/schemas";
import { computeRemaining } from "@/lib/verify/remaining";
import { historyIndicators, sortIndicators } from "@/lib/verify/risk";

export const POST = verifyRoute(
  "verify_dag_history",
  (b) => ({ p_khatian_id: uuid(b.khatian_id, "khatian"), p_dag_id: uuid(b.dag_id, "dag"), p_nid_no: nid(b.nid_no), p_dob: dob(b.dob), p_owner_id: uuid(b.owner_id, "owner", { optional: true }) }),
  (d, body) => {
    if (!d.found) return d;
    const remaining = d.owner_share == null ? null : computeRemaining({ dagArea: d.dag.area, ownerShare: d.owner_share, soldByDonor: d.donor_sold_total, selling: optionalPositive(body.selling) });
    return { ...d, remaining, indicators: sortIndicators(historyIndicators(d, remaining)) };
  }
);
