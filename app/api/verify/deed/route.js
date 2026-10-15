import { verifyRoute } from "@/lib/api";
import { str, date } from "@/lib/verify/schemas";
import { deedIndicators, sortIndicators } from "@/lib/verify/risk";

export const POST = verifyRoute(
  "verify_deed",
  (b) => ({ p_deed_no: str(b.deed_no, "deed number", { max: 12, re: /^[0-9০-৯]{1,6}(\/[0-9০-৯]{4})?$/ }), p_deed_date: date(b.deed_date, "Deed date") }),
  (d) => ({ ...d, indicators: sortIndicators(deedIndicators(d)) })
);
