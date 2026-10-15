import { verifyRoute } from "@/lib/api";
import { uuid } from "@/lib/verify/schemas";

export const POST = verifyRoute("verify_khatian_types", (b) => ({ p_location_id: uuid(b.location_id, "location") }));
