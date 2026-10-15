import { verifyRoute } from "@/lib/api";
import { str } from "@/lib/verify/schemas";
import { warishIndicators } from "@/lib/verify/risk";

export const POST = verifyRoute(
  "verify_warish",
  (b) => ({ p_cert_no: str(b.cert_no, "certificate number", { max: 60 }) }),
  (d) => ({ ...d, indicators: warishIndicators(d) })
);
