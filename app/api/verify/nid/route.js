import { verifyRoute } from "@/lib/api";
import { nid, dob } from "@/lib/verify/schemas";

export const POST = verifyRoute("verify_nid", (b) => ({ p_nid_no: nid(b.nid_no), p_dob: b.dob ? dob(b.dob) : null }));
