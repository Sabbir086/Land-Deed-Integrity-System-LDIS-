import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import DummyDataImporter from "@/components/admin/DummyDataImporter";

export const dynamic = "force-dynamic";
export const metadata = { title: "Add Dummy Data" };

export default async function DummyDataPage() {
  const { user } = await requireRole(["admin"]);

  if (user.email?.toLowerCase() !== "joysabbir086@gmail.com") {
    redirect("/access-denied");
  }

  return <DummyDataImporter />;
}
