"use client";
import { useFormState, useFormStatus } from "react-dom";
import { Alert, Button, Field, Input } from "@/components/ui";

function Submit({ children }) {
  const { pending } = useFormStatus();
  return <Button type="submit" disabled={pending} className="w-full">{pending ? "অপেক্ষা করুন…" : children}</Button>;
}

export default function AuthForm({ action, mode, next }) {
  const [state, formAction] = useFormState(action, null);
  const signup = mode === "signup";
  return (
    <form action={formAction} className="space-y-4" noValidate>
      {state?.error && <Alert tone="error">{state.error}</Alert>}
      {state?.ok && <Alert tone="success">{state.ok}</Alert>}
      {next && <input type="hidden" name="next" value={next} />}
      {signup && <Field label="পূর্ণ নাম · Full name" htmlFor="full_name"><Input id="full_name" name="full_name" autoComplete="name" required /></Field>}
      <Field label="ইমেইল · Email" htmlFor="email"><Input id="email" name="email" type="email" autoComplete="email" required /></Field>
      <Field label="পাসওয়ার্ড · Password" htmlFor="password" hint={signup ? "কমপক্ষে ৮ অক্ষর" : undefined}>
        <Input id="password" name="password" type="password" autoComplete={signup ? "new-password" : "current-password"} required minLength={signup ? 8 : undefined} />
      </Field>
      {signup && <Field label="পাসওয়ার্ড নিশ্চিত করুন" htmlFor="confirm"><Input id="confirm" name="confirm" type="password" autoComplete="new-password" required /></Field>}
      <Submit>{signup ? "অ্যাকাউন্ট তৈরি করুন" : "লগইন"}</Submit>
    </form>
  );
}
