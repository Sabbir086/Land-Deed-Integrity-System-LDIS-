import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Alert, Card, PageHeader } from "@/components/ui";
import StaffActions from "@/components/staff/StaffActions";
export const dynamic="force-dynamic";
export default async function RegistrarApplication({params}) {
 await requireRole(["sub_registrar"]);
 const {data,error}=await createClient().rpc("staff_application_detail",{p_app:params.id});
 if(error||!data?.application) notFound();
 const a=data.application;
 return <><PageHeader title={`Review ${a.application_no}`} titleEn="Application review" actions={<Link className="underline" href="/sub-registrar">Back to queue</Link>}/>
 <Alert tone="warn" title="DEMO review">Review evidence carefully. This application summary is based on project reference data, not an official determination.</Alert>
 <div className="grid gap-4 lg:grid-cols-2">
 <Card title="Application & applicant"><p>Status: <b>{a.status}</b></p><p>Applicant: {data.applicant?.full_name||"—"} ({data.applicant?.email||"—"})</p><p>Location: {[a.district,a.upazila,a.mouza].filter(Boolean).join(" / ")||"—"}</p><p>Khatian: {a.khatian_type||"—"} {a.khatian_no||""}</p><p>Sale price: {a.sale_price??"—"}</p><p>Biometric status: {a.biometric_status}</p><h4 className="mt-3 font-semibold">Risk flags</h4><pre className="whitespace-pre-wrap text-xs">{JSON.stringify(a.flags,null,2)}</pre><h4 className="mt-3 font-semibold">System blockers</h4><pre className="whitespace-pre-wrap text-xs">{JSON.stringify(a.blockers,null,2)}</pre></Card>
 <Card title="Parties & ownership"><pre className="whitespace-pre-wrap text-xs">{JSON.stringify({parties:data.parties,ownership:data.ownership,plots:data.plots},null,2)}</pre></Card>
 <Card title="Fee items & challans"><pre className="whitespace-pre-wrap text-xs">{JSON.stringify({fees:data.fees,challans:data.challans},null,2)}</pre><p className="mt-2 text-xs text-slate-500">Challan references are demo data; payment gateway confirmation is not integrated.</p></Card>
 <Card title="Documents, appointments & history"><pre className="whitespace-pre-wrap text-xs">{JSON.stringify({documents:data.documents,appointments:data.appointments,corrections:data.corrections,status_history:data.history},null,2)}</pre><p className="mt-2 text-xs">Document metadata is shown; private storage object access depends on Storage policies.</p></Card>
 </div><div className="mt-5"><StaffActions applicationId={a.id} status={a.status}/></div></>;
}
