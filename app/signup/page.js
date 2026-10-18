import Link from "next/link";
import AuthForm from "@/components/AuthForm";
import { Alert, Card } from "@/components/ui";
import { signup } from "./actions";

export const metadata = { title: "নিবন্ধন" };

export default function SignupPage() {
  return (
    <section className="ldis-auth-screen ldis-signup-screen" aria-label="নিবন্ধন">
      <div className="ldis-auth-panel ldis-signup-panel">
        <Card
          className="ldis-login-card ldis-signup-card"
          title="নতুন অ্যাকাউন্ট"
          subtitle="নিবন্ধনের পর Admin অনুমোদন প্রয়োজন · Admin approval required"
        >
          <AuthForm action={signup} mode="signup" />
          <p className="ldis-register-prompt ldis-signup-login-prompt">
            আগে থেকেই অ্যাকাউন্ট আছে? <Link href="/login">লগইন</Link>
          </p>
          <div className="ldis-signup-notice">
            <Alert>নিবন্ধনের পর Admin অনুমোদন না দেওয়া পর্যন্ত লগইন করা যাবে না। Role ও access কেবল Admin নির্ধারণ করবেন।</Alert>
          </div>
        </Card>
      </div>
    </section>
  );
}
