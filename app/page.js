import Link from "next/link";
import { getSessionProfile } from "@/lib/auth";
import { homeFor } from "@/lib/roles";
import { Card, Disclaimer } from "@/components/ui";

export default async function Home() {
  let profile = null;
  try { ({ profile } = await getSessionProfile()); } catch {}
  return (
    <div className="space-y-8">
      <section className="rounded-lg bg-brand-800 px-6 py-10 text-white">
        <h1 className="text-3xl font-bold">জমি বিক্রির আগে তথ্য যাচাই করুন</h1>
        <p className="mt-3 max-w-2xl text-brand-100">NID, পর্চা/খতিয়ান, পূর্ববর্তী দলিল, ওয়ারিশ সনদ, সরকারি স্বার্থ ও ই-চালানের তথ্য একই জায়গায় মিলিয়ে দেখুন — উৎস, ফলাফল ও অনিশ্চয়তাসহ।</p>
        <p className="mt-1 max-w-2xl text-sm text-brand-200">Check identity, land records, earlier deeds, government interest and fees in one place.</p>
        <div className="mt-6 flex flex-wrap gap-3">
          {profile
            ? <Link href={homeFor(profile.role)} className="rounded-md bg-white px-5 py-2.5 font-semibold text-brand-800">ড্যাশবোর্ডে যান</Link>
            : <><Link href="/login" className="rounded-md bg-white px-5 py-2.5 font-semibold text-brand-800">লগইন</Link>
                <Link href="/signup" className="rounded-md border border-white px-5 py-2.5 font-semibold">নতুন অ্যাকাউন্ট</Link></>}
        </div>
      </section>
      <div className="grid gap-4 md:grid-cols-3">
        <Card title="তিনটি আলাদা বিষয়" subtitle="Core principle"><p className="text-sm text-slate-700">রেকর্ড পাওয়া, রেকর্ড না পাওয়া এবং তার ভিত্তিতে সিদ্ধান্ত — এই তিনটি আলাদা। সিস্টেম কখনো এগুলো মিশিয়ে ফেলে না।</p></Card>
        <Card title="ভূমিকা অনুযায়ী প্রবেশ" subtitle="Role-based access"><p className="text-sm text-slate-700">ব্যবহারকারী, সাব-রেজিস্ট্রার ও প্রশাসকের জন্য আলাদা ড্যাশবোর্ড। ভূমিকা সার্ভার-সাইডে যাচাই করা হয়।</p></Card>
        <Card title="নিরাপদ ডেটা" subtitle="Protected reference data"><p className="text-sm text-slate-700">রেফারেন্স ডেটাবেজ সরাসরি ব্রাউজারে খোলা নেই; শুধু সীমিত, অনুমোদিত ফাংশনের মাধ্যমে।</p></Card>
      </div>
      <Disclaimer />
    </div>
  );
}
