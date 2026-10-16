import Link from "next/link";
import { Card, Alert } from "@/components/ui";

export const metadata = { title: "অনুমোদনের অপেক্ষায়" };
export default function PendingApprovalPage() {
  return <div className="mx-auto max-w-xl"><Card title="অ্যাকাউন্ট অনুমোদনের অপেক্ষায়" subtitle="Account pending approval">
    <Alert tone="warn">আপনার নিবন্ধন সফল হয়েছে। Admin অনুমোদন দেওয়ার পর একই ইমেইল ও পাসওয়ার্ড দিয়ে লগইন করতে পারবেন।</Alert>
    <p className="mt-4 text-sm text-slate-600">Your account is pending administrator approval. Please try logging in after the administrator approves it.</p>
    <p className="mt-4"><Link className="text-brand-700 underline" href="/login">লগইন পেজে ফিরে যান · Back to login</Link></p>
  </Card></div>;
}
