import { verifyRoute } from "@/lib/api";
import { uuid, nid, dob } from "@/lib/verify/schemas";
import { compareOwnerToPerson } from "@/lib/verify/matching";
import { ownerIdentityIndicators } from "@/lib/verify/risk";

// The comparison is computed HERE (server) so the browser cannot influence the outcome.
export const POST = verifyRoute(
  "verify_owner_identity",
  (b) => ({ p_owner_id: uuid(b.owner_id, "owner"), p_nid_no: nid(b.nid_no), p_dob: dob(b.dob) }),
  (d) => {
    if (!d.found) return d;
    const comparison = compareOwnerToPerson({ owner: d.owner, person: d.person, attestations: d.attestations });
    return { found: true, owner: { name: d.owner.name, father_name: d.owner.father_name, share: d.owner.share }, person: { name: d.person.name, father_name: d.person.father_name }, comparison, indicators: ownerIdentityIndicators(comparison) };
  }
);
