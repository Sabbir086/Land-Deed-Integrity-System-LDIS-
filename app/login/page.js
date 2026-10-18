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
    <section className="ldis-auth-screen" aria-label="লগইন">
      <div className="ldis-auth-panel">
        <Card className="ldis-login-card" title="লগইন" subtitle="Sign in to continue · User, Sub-Registrar or Administrator">
          <AuthForm action={login} mode="login" next={searchParams?.next} />
        </Card>
      </div>
    </section>
  );
}
