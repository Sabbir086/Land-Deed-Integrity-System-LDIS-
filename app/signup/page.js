import Link from "next/link";
import AuthForm from "@/components/AuthForm";
import { Alert, Card } from "@/components/ui";
import { signup } from "./actions";

export const metadata = { title: "নিবন্ধন" };

export default function SignupPage() {
  return (
    <div className="mx-auto max-w-md space-y-4">
      <Card title="নতুন অ্যাকাউন্ট" subtitle="নিবন্ধনের পর Admin অনুমোদন প্রয়োজন · Admin approval required">
        <AuthForm action={signup} mode="signup" />
        <p className="mt-4 text-sm text-slate-600">আগে থেকেই অ্যাকাউন্ট আছে? <Link href="/login" className="text-brand-700 underline">লগইন</Link></p>
      </Card>
      <Alert>নিবন্ধনের পর Admin অনুমোদন না দেওয়া পর্যন্ত লগইন করা যাবে না। Role ও access কেবল Admin নির্ধারণ করবেন।</Alert>
    </div>
  );
}
