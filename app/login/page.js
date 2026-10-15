import Link from "next/link";
import { redirect } from "next/navigation";
import AuthForm from "@/components/AuthForm";
import { Card } from "@/components/ui";
import { login } from "./actions";
import { getSessionProfile } from "@/lib/auth";
import { homeFor } from "@/lib/roles";

export const metadata = { title: "লগইন" };

export default async function LoginPage({ searchParams }) {
  try { const { profile } = await getSessionProfile(); if (profile) redirect(homeFor(profile.role)); }
  catch (e) { if (e?.digest?.startsWith("NEXT_REDIRECT")) throw e; }
  return (
    <div className="mx-auto max-w-md">
      <Card title="লগইন" subtitle="Sign in (user, sub-registrar or administrator)">
        <AuthForm action={login} mode="login" next={searchParams?.next} />
        <p className="mt-4 text-sm text-slate-600">অ্যাকাউন্ট নেই? <Link href="/signup" className="text-brand-700 underline">নিবন্ধন করুন</Link></p>
      </Card>
    </div>
  );
}
