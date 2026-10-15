import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Alert, PageHeader, Card } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "সাব-রেজিস্ট্রার workspace" };
export default async function SubRegistrarDashboard() {
 const {profile}=await requireRole(["sub_registrar"]);
 const {data,error}=await createClient().rpc("staff_queue",{p_status:null});
 const rows=data?.applications||[];
 return <><PageHeader title="সাব-রেজিস্ট্রার workspace" titleEn="Jurisdiction-bound review queue" description={`Assigned jurisdiction: ${profile.district||"—"} / ${profile.upazila||"—"}`} />
 <Alert tone="warn" title="DEMO system only">Reference data is not an official government source. A negative lookup is not legal clearance. Registration records created here are DEMO only.</Alert>
 {error&&<Alert tone="error">Queue unavailable. Apply migration 10 after migrations 06–09 and verify office_district/office_upazila routing fields.</Alert>}
 <Card title={`Assigned applications (${rows.length})`}><div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left"><th className="p-2">Application</th><th className="p-2">Status</th><th className="p-2">Location</th><th className="p-2">Submitted</th><th className="p-2">Open</th></tr></thead><tbody>{rows.map(a=><tr key={a.id} className="border-b"><td className="p-2">{a.application_no}</td><td className="p-2">{a.status}</td><td className="p-2">{[a.district,a.upazila,a.mouza].filter(Boolean).join(" / ")||"—"}</td><td className="p-2">{a.submitted_at?new Date(a.submitted_at).toLocaleString():"—"}</td><td className="p-2"><Link className="text-blue-700 underline" href={`/sub-registrar/applications/${a.id}`}>Review</Link></td></tr>)}{!rows.length&&<tr><td colSpan="5" className="p-3 text-slate-500">No applications in this assigned jurisdiction, or required migrations/routing fields are not ready.</td></tr>}</tbody></table></div></Card>
 </>;
}
