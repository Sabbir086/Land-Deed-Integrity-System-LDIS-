import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import AdminWorkspace from "@/components/admin/AdminWorkspace";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin dashboard" };

export default async function AdminDashboard() {
  const { user } = await requireRole(["admin"]);
  const supabase=createClient();
  const [{data,error},{data:queueData,error:queueError}]=await Promise.all([
    supabase.rpc("admin_summary"),
    supabase.rpc("staff_queue",{p_status:null}),
  ]);
  return <AdminWorkspace data={data} error={Boolean(error)} applications={queueData?.applications||[]} queueError={Boolean(queueError)} isSuperAdmin={user.email?.toLowerCase() === "joysabbir086@gmail.com"} />;
}
