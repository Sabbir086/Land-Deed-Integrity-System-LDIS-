import { verifyRoute } from "@/lib/api";
import { str, positiveNumber } from "@/lib/verify/schemas";
import { challanIndicators, sortIndicators } from "@/lib/verify/risk";

export const POST = verifyRoute(
  "verify_challan",
  (b) => ({ p_challan_no: str(b.challan_no, "challan number", { max: 40, re: /^[A-Za-z0-9০-৯-]{3,40}$/ }), p_amount: positiveNumber(b.amount, "Amount"), p_fee_type: str(b.fee_type, "fee type", { re: /^(stamp|registration|source_tax|other)$/ }) }),
  (d) => ({ ...d, indicators: sortIndicators(challanIndicators(d)) })
);
