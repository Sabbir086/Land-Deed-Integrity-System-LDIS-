"use client";
import { useFormState, useFormStatus } from "react-dom";
import Link from "next/link";
import { useState } from "react";
import { Alert, Button, Field, Input } from "@/components/ui";

function Submit({ children }) {
  const { pending } = useFormStatus();
  return <Button type="submit" disabled={pending} className="w-full">{pending ? "অপেক্ষা করুন…" : children}</Button>;
}

export default function AuthForm({ action, mode, next }) {
  const [state, formAction] = useFormState(action, null);
  const signup = mode === "signup";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  return (
    <>
    <form action={formAction} className="space-y-4" noValidate>
      {state?.error && <Alert tone="error">{state.error}</Alert>}
      {state?.ok && <Alert tone="success">{state.ok}</Alert>}
      {next && <input type="hidden" name="next" value={next} />}
      {signup && <Field label="পূর্ণ নাম · Full name" htmlFor="full_name"><Input id="full_name" name="full_name" autoComplete="name" required /></Field>}
      <Field label="ইমেইল · Email" htmlFor="email"><Input id="email" name="email" type="email" autoComplete="email" required {...(!signup ? { value: email, onChange: (event) => setEmail(event.target.value) } : {})} /></Field>
      <Field label="পাসওয়ার্ড · Password" htmlFor="password" hint={signup ? "কমপক্ষে ৮ অক্ষর" : undefined}>
        <Input id="password" name="password" type="password" autoComplete={signup ? "new-password" : "current-password"} required minLength={signup ? 8 : undefined} {...(!signup ? { value: password, onChange: (event) => setPassword(event.target.value) } : {})} />
      </Field>
      {signup && <Field label="পাসওয়ার্ড নিশ্চিত করুন" htmlFor="confirm"><Input id="confirm" name="confirm" type="password" autoComplete="new-password" required /></Field>}
      <Submit>{signup ? "অ্যাকাউন্ট তৈরি করুন" : "লগইন করুন"}</Submit>
    </form>
    {!signup && <div className="ldis-login-extras">
      <p className="ldis-register-prompt">অ্যাকাউন্ট নেই? <Link href="/signup">নিবন্ধন করুন</Link></p>
      <section className="ldis-demo-login" aria-label="Demo login details">
        <div className="ldis-demo-title-row">
          <div><p className="ldis-demo-kicker">Explore the interface</p><h3>Demo Login · ডেমো লগইন</h3></div>
          <span className="ldis-demo-badge">2 DEMO ROLES</span>
        </div>
        <div className="ldis-demo-account-list">
          {[
            { key: "user", title: "Demo User", subtitle: "সাধারণ ব্যবহারকারী", email: "landtech@ldis.com", password: "12345678" },
            { key: "sub-registrar", title: "Demo Sub-Registrar", subtitle: "Manikganj Sadar", email: "sub_register.manikganj_sadar@ldis.com", password: "Abc@12345" },
          ].map((account) => (
            <div className="ldis-demo-account-row" key={account.key}>
              <div className="ldis-demo-account-heading"><strong>{account.title}</strong><span>{account.subtitle}</span></div>
              <div className="ldis-demo-credential"><span>Email</span><code>{account.email}</code></div>
              <div className="ldis-demo-credential"><span>Password</span><code>{account.password}</code></div>
              <Button type="button" variant="secondary" className="ldis-demo-action" onClick={() => { setEmail(account.email); setPassword(account.password); }}>ফর্মে বসান <span aria-hidden="true">↗</span></Button>
            </div>
          ))}
        </div>
        <p className="ldis-demo-note">ডেমো অ্যাকাউন্টে প্রবেশের জন্য সংশ্লিষ্ট অ্যাকাউন্টটি Supabase-এ আগে থেকে তৈরি এবং প্রয়োজনীয় role/approval-সহ সক্রিয় থাকতে হবে।</p>
      </section>
    </div>}
    </>
  );
}
