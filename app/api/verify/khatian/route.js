import { verifyRoute } from "@/lib/api";
import { uuid, str, digits } from "@/lib/verify/schemas";
import { khatianIndicators, sortIndicators } from "@/lib/verify/risk";

export const POST = verifyRoute(
  "verify_khatian",
  (b) => ({ p_location_id: uuid(b.location_id, "location"), p_khatian_type: str(b.khatian_type, "khatian type", { max: 40 }), p_khatian_no: digits(b.khatian_no, "khatian number") }),
  (d) => ({ ...d, indicators: sortIndicators(khatianIndicators(d)) })
);
