import { verifyRoute } from "@/lib/api";
import { digits, str, uuid } from "@/lib/verify/schemas";
import { khatianIndicators, sortIndicators } from "@/lib/verify/risk";

const withIndicators = (record) => ({
  ...record,
  indicators: sortIndicators(khatianIndicators(record))
});

export const POST = verifyRoute(
  "verify_khatian_by_dag",
  (body) => ({
    p_location_id: uuid(body.location_id, "location"),
    p_khatian_type: str(body.khatian_type, "khatian type", { max: 40 }),
    p_dag_no: digits(body.dag_no, "dag number")
  }),
  (data) => data?.candidates
    ? { ...data, candidates: data.candidates.map(withIndicators) }
    : withIndicators(data)
);
