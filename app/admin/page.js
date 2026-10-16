import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Alert, Card, PageHeader } from "@/components/ui";
import UserApprovalPanel from "@/components/admin/UserApprovalPanel";
export const dynamic="force-dynamic";
export const metadata={title:"Admin dashboard"};
export default async function AdminDashboard(){
 await requireRole(["admin"]);
 const {data,error}=await createClient().rpc("admin_summary");
 const counts=data?.status_counts||{};
 return <><PageHeader title="Admin dashboard" titleEn="Operations, roles and audit overview"/>
 <Alert tone="warn" title="Admin access">Admin can access all programme workflows and manage account approvals and roles. This project is a demo, not an official government registration service.</Alert>
 <UserApprovalPanel />
 {error&&<Alert tone="error">Admin summary unavailable. Apply migrations 06–10 in order and inspect database errors.</Alert>}
 <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 my-5">
 <Card title="Normal users"><p className="text-3xl font-bold">{data?.users_total??"—"}</p></Card>
 <Card title="Registration records"><p className="text-3xl font-bold">{data?.registrations_total??"—"}</p><p className="text-xs">DEMO records only</p></Card>
 {Object.entries(counts).map(([s,n])=><Card key={s} title={s}><p className="text-3xl font-bold">{n}</p></Card>)}
 </div>
 <div className="grid gap-4 lg:grid-cols-2"><Card title="Sub-registrar jurisdiction"><div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr><th className="p-2 text-left">Registrar</th><th className="p-2 text-left">District</th><th className="p-2 text-left">Upazila</th></tr></thead><tbody>{(data?.registrars||[]).map((r,i)=><tr key={r.email||i} className="border-t"><td className="p-2">{r.full_name||r.email}</td><td className="p-2">{r.district}</td><td className="p-2">{r.upazila}</td></tr>)}</tbody></table></div></Card>
 <Card title="Recent audit events"><div className="space-y-3">{(data?.recent_audit||[]).map(x=><div key={x.id} className="border-b pb-2 text-sm"><p className="font-medium">{x.action} · {x.actor_role}</p><p className="break-all text-xs text-slate-600">{x.application_id||"—"} · {new Date(x.created_at).toLocaleString()}</p><pre className="whitespace-pre-wrap text-xs">{JSON.stringify(x.details)}</pre></div>)}{!data?.recent_audit?.length&&<p className="text-sm text-slate-500">No audit events yet.</p>}</div></Card></div>
 </>;
}
