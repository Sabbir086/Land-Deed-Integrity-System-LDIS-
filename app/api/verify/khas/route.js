import { verifyRoute } from "@/lib/api";
import { uuid, digits } from "@/lib/verify/schemas";
import { khasIndicators } from "@/lib/verify/risk";

export const POST = verifyRoute(
  "verify_khas",
  (b) => {
    if (!Array.isArray(b.dag_nos) || b.dag_nos.length < 1 || b.dag_nos.length > 10) throw new Error("Select 1 to 10 dags");
    return { p_location_id: uuid(b.location_id, "location"), p_khatian_no: digits(b.khatian_no, "khatian number"), p_dag_nos: b.dag_nos.map((x) => digits(x, "dag number")) };
  },
  (d) => ({ ...d, indicators: khasIndicators(d) })
);
