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
          <span className="ldis-demo-badge">VISITOR ACCESS</span>
        </div>
        <div className="ldis-demo-credentials">
          <div className="ldis-demo-credential"><span>Email</span><code>landtech@ldis.com</code></div>
          <div className="ldis-demo-credential"><span>Password</span><code>12345678</code></div>
        </div>
        <Button type="button" variant="secondary" className="ldis-demo-action" onClick={() => { setEmail("landtech@ldis.com"); setPassword("12345678"); }}>ডেমো তথ্য ফর্মে বসান <span aria-hidden="true">↗</span></Button>
        <p className="mt-2 text-xs leading-5 text-slate-500">ডেমো অ্যাকাউন্টে প্রবেশের জন্য এই অ্যাকাউন্টটি সিস্টেমে আগে থেকে তৈরি ও অনুমোদিত থাকতে হবে।</p>
      </section>
    </div>}
    </>
  );
}
