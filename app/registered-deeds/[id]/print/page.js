import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import PrintButton from "@/components/registered-deeds/PrintButton";

export const dynamic = "force-dynamic";
export const metadata = { title: "নিবন্ধিত demo দলিল · Print" };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const labels = { saf_kabala:"সাফ-কবলা দলিল", heba_declaration:"হেবা ঘোষণাপত্র / হেবা দলিল", gift_deed:"দানপত্র দলিল", partition_deed:"বণ্টননামা দলিল", exchange_deed:"বিনিময় দলিল", mortgage_deed:"বন্ধক দলিল", sale_agreement:"বায়নাপত্র / বিক্রয় চুক্তি", release_deed:"দাবি/স্বত্ব ত্যাগ দলিল", will_deed:"অছিয়তনামা", other:"অন্যান্য" };
const dateText = (v) => v ? new Date(`${String(v).slice(0,10)}T00:00:00`).toLocaleDateString("bn-BD", { year:"numeric", month:"long", day:"numeric" }) : "—";
const moneyText = (v) => v == null ? "—" : `৳ ${Number(v).toLocaleString("en-IN")}`;
function Row({ label, children }) { return <div className="grid grid-cols-[8.5rem_1fr] gap-3 border-b border-slate-200 py-2 text-sm last:border-0"><dt className="text-slate-500">{label}</dt><dd className="break-words font-medium">{children || "—"}</dd></div>; }

export default async function RegisteredDeedPrint({ params }) {
  const { profile } = await requireRole(["user", "sub_registrar", "admin"]);
  if (!UUID.test(params.id)) notFound();
  const { data, error } = await createClient().rpc("get_registered_deed_print", { p_app: params.id });
  if (error || !data?.record) notFound();
  const rec = data.record;
  const donor = (data.parties || []).find((p) => p.role === "donor");
  const donees = (data.parties || []).filter((p) => p.role === "donee" || /^donee_\d+$/.test(p.role));
  const parties = [donor, ...donees].filter(Boolean);
  const back = profile.role === "sub_registrar" ? `/sub-registrar/applications/${params.id}` : profile.role === "admin" ? `/admin/applications/${params.id}` : "/dashboard/applications";
  return <main className="mx-auto max-w-4xl space-y-5 p-4 sm:p-8 print:max-w-none print:p-0">
    <header className="flex items-center justify-between gap-3 print:hidden"><Link href={back} className="text-sm underline">← ফিরে যান</Link><PrintButton /></header>
    <header className="rounded-xl border-2 border-amber-400 bg-amber-50 p-4 text-center print:rounded-none"><p className="text-xs font-bold uppercase tracking-widest text-amber-800">LDIS · DEMONSTRATION RECORD</p><h1 className="mt-2 text-2xl font-bold">দলিলের ডেমো কপি</h1><p className="mt-1 text-sm font-semibold">এটি সরকারি নিবন্ধন দলিল নয় এবং আইনগত প্রমাণ হিসেবে ব্যবহারযোগ্য নয়।</p></header>
    <section className="rounded-xl border p-5 print:break-inside-avoid"><h2 className="mb-3 border-b pb-2 text-lg font-bold">দলিলের মূল তথ্য</h2><dl>
      <Row label="ডেমো দলিল নম্বর">{rec.demo_deed_no}</Row><Row label="অভ্যন্তরীণ reference">{rec.registration_ref}</Row><Row label="দলিলের তারিখ">{dateText(rec.deed_date)}</Row><Row label="দলিলের প্রকৃতি">{labels[data.deed_nature] || data.deed_nature}</Row><Row label="দলিলের মূল্য">{moneyText(data.sale_price)}</Row><Row label="নিবন্ধনের সময়">{rec.registered_at ? new Date(rec.registered_at).toLocaleString("bn-BD") : "—"}</Row>
    </dl></section>
    <section className="rounded-xl border p-5 print:break-inside-avoid"><h2 className="mb-3 border-b pb-2 text-lg font-bold">দাতা ও গ্রহীতার পরিচয় · NID-linked details</h2><div className="space-y-4">
      {parties.map((p,i)=><div key={`${p.role}-${p.person_id || i}`} className="rounded-lg border p-3 print:break-inside-avoid"><h3 className="mb-2 font-bold">{p.role === "donor" ? "দাতা" : `গ্রহীতা ${i || 1}`}</h3><dl>
        <Row label="নাম">{p.name_bn}</Row><Row label="পিতার নাম">{p.father_name}</Row><Row label="মাতার নাম">{p.mother_name}</Row><Row label="NID নম্বর">{p.nid_no}</Row><Row label="জন্মতারিখ">{dateText(p.dob)}</Row><Row label="লিঙ্গ">{p.gender}</Row><Row label="ঠিকানা">{p.address}</Row><Row label="পেশা">{p.occupation}</Row>
      </dl></div>)}
    </div></section>
    <section className="rounded-xl border p-5 print:break-inside-avoid"><h2 className="mb-3 border-b pb-2 text-lg font-bold">জমির তফসিল</h2><dl>
      <Row label="বিভাগ">{data.location?.division}</Row><Row label="জেলা">{data.location?.district}</Row><Row label="উপজেলা">{data.location?.upazila}</Row><Row label="মৌজা">{data.location?.mouza}</Row><Row label="পর্চার ধরন">{data.location?.khatian_type}</Row><Row label="খতিয়ান নম্বর">{data.location?.khatian_no}</Row>
    </dl><div className="mt-3 overflow-x-auto"><table className="w-full border-collapse text-sm"><thead><tr className="bg-slate-100"><th className="border p-2 text-left">দাগ নম্বর</th><th className="border p-2 text-left">জমির শ্রেণি</th><th className="border p-2 text-right">মোট জমি</th><th className="border p-2 text-right">দলিলে অন্তর্ভুক্ত</th></tr></thead><tbody>
      {(data.plots||[]).map((p,i)=><tr key={`${p.dag_no}-${i}`}><td className="border p-2">{p.dag_no}</td><td className="border p-2">{p.land_class || "—"}</td><td className="border p-2 text-right">{p.dag_area ?? "—"}</td><td className="border p-2 text-right">{p.area_sold ?? "—"}</td></tr>)}{!data.plots?.length&&<tr><td colSpan="4" className="border p-2 text-center">কোনো দাগের বিবরণ নেই</td></tr>}
    </tbody></table></div></section>
    <section className="rounded-xl border p-5 print:break-inside-avoid"><h2 className="mb-3 border-b pb-2 text-lg font-bold">সাক্ষী</h2><div className="grid gap-3 sm:grid-cols-2">{(data.witnesses||[]).map(w=><div key={w.serial} className="rounded-lg border p-3"><p className="font-semibold">সাক্ষী {w.serial}: {w.name}</p><p className="mt-1 text-sm text-slate-600">পিতার নাম: {w.father_name || "—"}</p><div className="mt-8 border-t pt-1 text-xs text-slate-500">স্বাক্ষর</div></div>)}</div></section>
    <footer className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-xs leading-5 text-amber-900"><p className="font-bold">গুরুত্বপূর্ণ নোট</p><p>{data.notice || "এটি শুধুমাত্র ডেমো রেকর্ড। সরকারি নিবন্ধন নয়।"}</p><p>দাতা/গ্রহীতার ব্যক্তিগত তথ্য অনুমোদিত ব্যবহারকারীর জন্য NID reference থেকে আনা হয়েছে। এই প্রিন্ট শুধুমাত্র প্রকল্পের পরীক্ষার উদ্দেশ্যে।</p></footer>
  </main>;
}
