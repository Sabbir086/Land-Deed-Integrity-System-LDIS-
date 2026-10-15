import { notFound, redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui";
import Wizard from "@/components/applications/Wizard";
import { canEdit } from "@/lib/applications/status";

export const metadata = { title: "দলিলের আবেদন" };
export const dynamic = "force-dynamic";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function EditApplication({ params }) {
  await requireRole(["user"]);
  if (!UUID.test(params.id)) notFound();
  const supabase = createClient();
  const { data, error } = await supabase.rpc("app_get", { p_app: params.id });
  if (error || !data?.application) notFound();                    // not yours / not found look identical
  if (!canEdit(data.application.application.status)) redirect(`/dashboard/applications/${params.id}`);
  return (<><PageHeader title="নতুন দলিলের আবেদন" titleEn="Apply for Deed" /><Wizard initial={data.application} /></>);
}
