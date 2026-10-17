import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Alert, Card, PageHeader } from "@/components/ui";
import StaffActions from "@/components/staff/StaffActions";
import RegistrarChecklist from "@/components/staff/RegistrarChecklist";
export const dynamic="force-dynamic";

function value(v) { if (v === null || v === undefined || v === "") return "—"; if (typeof v === "boolean") return v ? "হ্যাঁ" : "না"; if (typeof v === "object") return JSON.stringify(v); return String(v); }
function Field({label, value: v}) { return <div className="min-w-0 rounded-lg bg-slate-50 p-3"><div className="text-xs text-slate-500">{label}</div><div className="mt-1 break-words text-sm font-medium">{value(v)}</div></div>; }
function DataTable({title, rows, fields}) { return <Card title={`${title} (${rows?.length || 0})`}>{!rows?.length ? <p className="text-sm text-slate-500">কোনো তথ্য পাওয়া যায়নি।</p> : <div className="space-y-3">{rows.map((row,i)=><div key={row.id||i} className="rounded-lg border p-3"><div className="mb-2 font-semibold">{row.name_bn || row.name || row.fee_name || row.challan_no || row.deed_no || `${title} ${i+1}`}</div><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{fields.filter(([k])=>row[k]!==undefined).map(([k,label])=><Field key={k} label={label} value={row[k]} />)}</div></div>)}</div>}</Card>; }
function JsonSection({title,data}) { return <Card title={title}>{data===null||data===undefined ? <p className="text-sm text-slate-500">তথ্য পাওয়া যায়নি।</p> : <pre className="max-h-96 overflow-auto whitespace-pre-wrap break-words text-xs">{JSON.stringify(data,null,2)}</pre>}</Card>; }
export default async function RegistrarApplication({params}) {
 await requireRole(["sub_registrar"]);
 const {data,error}=await createClient().rpc("staff_application_detail",{p_app:params.id});
 if(error||!data?.application) notFound();
 const a=data.application;
 const parties=data.parties||[], plots=data.plots||[], fees=data.fees||[], challans=data.challans||[];
 return <><PageHeader title={`Review ${a.application_no}`} titleEn="Application review" actions={<Link className="underline" href="/sub-registrar">Back to queue</Link>}/>
 <Alert tone="warn" title="পরীক্ষামূলক পর্যালোচনা">এই সিস্টেমের তথ্য ডেমো/রেফারেন্স ডেটার ওপর ভিত্তি করে। নিবন্ধনের আগে প্রতিটি তথ্য যাচাই করুন।</Alert>
 <div className="space-y-4">
 <Card title="আবেদন ও আবেদনকারী"><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"><Field label="আবেদন নম্বর" value={a.application_no}/><Field label="বর্তমান অবস্থা" value={a.status}/><Field label="দলিলের প্রকৃতি" value={a.deed_nature}/><Field label="দলিলের তারিখ" value={a.deed_date}/><Field label="আবেদনকারী" value={data.applicant?.full_name}/><Field label="ইমেইল" value={data.applicant?.email}/><Field label="জেলা" value={a.district}/><Field label="উপজেলা" value={a.upazila}/><Field label="মৌজা" value={a.mouza}/><Field label="খতিয়ানের ধরন" value={a.khatian_type}/><Field label="খতিয়ান নম্বর" value={a.khatian_no}/><Field label="বিক্রয়মূল্য" value={a.sale_price}/><Field label="বায়োমেট্রিক অবস্থা" value={a.biometric_status}/><Field label="আবেদন জমার সময়" value={a.submitted_at}/></div></Card>
 <Card title="ঝুঁকি সূচক ও সিস্টেম ব্লকার"><h4 className="mb-2 font-semibold">Risk flags</h4>{!a.flags?.length ? <p className="text-sm text-slate-500">কোনো risk flag নেই।</p> : <div className="space-y-2">{a.flags.map((f,i)=><div key={f.code||i} className="rounded-lg border border-amber-200 p-3"><div className="font-semibold">{f.bn||f.code||`ঝুঁকি ${i+1}`} <span className="text-xs text-amber-700">{f.level||""}</span></div><p className="mt-1 text-sm">{f.detail||f.en||"অতিরিক্ত পর্যালোচনা প্রয়োজন।"}</p></div>)}</div>}<h4 className="mb-2 mt-4 font-semibold">System blockers</h4>{!a.blockers?.length ? <p className="text-sm text-emerald-700">কোনো সিস্টেম ব্লকার রিপোর্ট করা হয়নি।</p> : <ul className="list-disc space-y-1 pl-5 text-sm">{a.blockers.map((b,i)=><li key={i}>{typeof b==="string"?b:JSON.stringify(b)}</li>)}</ul>}</Card>
 <DataTable title="দাতা ও গ্রহীতার তথ্য" rows={parties} fields={[["role","ভূমিকা"],["name_bn","নাম"],["nid_masked","NID"],["dob","জন্মতারিখ"],["father_name","পিতার নাম"],["mother_name","মাতার নাম"],["address","ঠিকানা"],["occupation","পেশা"],["gender","লিঙ্গ"],["verified_at","যাচাইয়ের সময়"]]}/>
 <DataTable title="দলিলের সাক্ষী" rows={data.witnesses||[]} fields={[["name","সাক্ষীর নাম"],["father_name","পিতার নাম"]]}/>
 <JsonSection title="মালিকানা ও পূর্ববর্তী দলিল যাচাই" data={data.ownership}/>
 <DataTable title="জমির দাগ ও প্লট" rows={plots} fields={[["dag_no","দাগ নম্বর"],["dag_area","মোট জমি"],["area_sold","বিক্রয়াধীন জমি"],["already_sold","পূর্বে বিক্রিত জমি"],["remaining","অবশিষ্ট জমি"],["land_class","নির্বাচিত শ্রেণি"],["recorded_land_class","রেকর্ডীয় শ্রেণি"],["other_deeds_count","অন্যান্য দলিল"]]}/>
 <DataTable title="ফি-এর বিবরণ" rows={fees} fields={[["name_bn","ফি-এর নাম"],["name_en","Fee type"],["amount","পরিমাণ"],["fee_code","কোড"],["is_demo","ডেমো রেট"],["challan_type","চালানের ধরন"]]}/>
 <DataTable title="চালান যাচাই" rows={challans} fields={[["challan_no","চালান নম্বর"],["challan_type","চালানের ধরন"],["amount","পরিমাণ"],["paid_on","পরিশোধের তারিখ"],["verify_status","স্ট্যাটাস"],["verified_at","যাচাইয়ের সময়"]]}/>
 <DataTable title="সংযুক্ত নথি" rows={data.documents||[]} fields={[["document_type","নথির ধরন"],["file_name","ফাইলের নাম"],["status","স্ট্যাটাস"],["created_at","জমার সময়"]]}/>
 <DataTable title="অ্যাপয়েন্টমেন্ট" rows={data.appointments||[]} fields={[["appt_date","তারিখ"],["slot","সময়"],["purpose","উদ্দেশ্য"],["status","স্ট্যাটাস"],["office_district","জেলা অফিস"],["office_upazila","উপজেলা অফিস"]]}/>
 <DataTable title="সংশোধনের অনুরোধ" rows={data.corrections||[]} fields={[["message","কারণ"],["status","স্ট্যাটাস"],["requested_at","তারিখ"]]}/>
 <DataTable title="আবেদনের ইতিহাস" rows={data.history||[]} fields={[["from_status","আগের অবস্থা"],["to_status","নতুন অবস্থা"],["actor_role","কর্তার ভূমিকা"],["note","বিবরণ"],["created_at","সময়"]]}/>
 <RegistrarChecklist applicationId={a.id} parties={parties} plots={plots} fees={fees} challans={challans} documents={data.documents||[]} ownership={data.ownership} />
 <StaffActions applicationId={a.id} status={a.status}/>
 </div></>;
}
