import Link from "next/link";
import AuthForm from "@/components/AuthForm";
import { Alert, Card } from "@/components/ui";
import { signup } from "./actions";

export const metadata = { title: "নিবন্ধন" };

export default function SignupPage() {
  return (
    <div className="mx-auto max-w-md space-y-4">
      <Card title="নতুন অ্যাকাউন্ট" subtitle="Public sign-up creates an ordinary user account only">
        <AuthForm action={signup} mode="signup" />
        <p className="mt-4 text-sm text-slate-600">আগে থেকেই অ্যাকাউন্ট আছে? <Link href="/login" className="text-brand-700 underline">লগইন</Link></p>
      </Card>
      <Alert>সাব-রেজিস্ট্রার ও প্রশাসক অ্যাকাউন্ট নিবন্ধন ফর্ম থেকে তৈরি হয় না; সেগুলো কেবল ডেটাবেজ প্রশাসক দেন।</Alert>
    </div>
  );
}
