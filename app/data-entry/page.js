import { requireRole } from "@/lib/auth";
import ManualDataEntry from "@/components/data-entry/ManualDataEntry";

export const dynamic = "force-dynamic";
export const metadata = { title: "Manual Data Entry" };

export default async function DataEntryPage() {
  await requireRole(["data_entry_operator"]);
  return <ManualDataEntry />;
}
