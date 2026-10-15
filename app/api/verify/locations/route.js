import { verifyRoute } from "@/lib/api";
import { str } from "@/lib/verify/schemas";

export const POST = verifyRoute("verify_location_options", (b) => ({
  p_level: str(b.level, "level", { re: /^(division|district|upazila|mouza)$/ }),
  p_division: str(b.division, "division", { optional: true }),
  p_district: str(b.district, "district", { optional: true }),
  p_upazila: str(b.upazila, "upazila", { optional: true }),
}));
