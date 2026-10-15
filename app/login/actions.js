"use server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { homeFor } from "@/lib/roles";
import { safeNext } from "@/lib/safe-redirect";

export async function login(_prev, formData) {
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");
  const next = formData.get("next");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 1) return { error: "সঠিক ইমেইল ও পাসওয়ার্ড দিন। Enter a valid email and password." };

  let supabase;
  try { supabase = createClient(); } catch (e) { return { error: e.message }; }
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data?.user) return { error: "ইমেইল বা পাসওয়ার্ড ভুল। Incorrect email or password." }; // generic on purpose

  // Role comes from public.profiles (trusted), never from the form.
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", data.user.id).maybeSingle();
  if (!profile) { await supabase.auth.signOut(); return { error: "এই অ্যাকাউন্টের প্রোফাইল পাওয়া যায়নি। Profile row missing; contact the administrator." }; }
  const home = homeFor(profile.role);
  // `next` is honoured only for ordinary users; privileged roles always land on their own dashboard.
  redirect(profile.role === "user" ? safeNext(next, home) : home);
}
