"use server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function signup(_prev, formData) {
  const full_name = String(formData.get("full_name") || "").trim();
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");
  const confirm = String(formData.get("confirm") || "");
  if (full_name.length < 2 || full_name.length > 100) return { error: "পূর্ণ নাম দিন (২–১০০ অক্ষর)। Enter your full name." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "সঠিক ইমেইল দিন। Enter a valid email." };
  if (password.length < 8) return { error: "পাসওয়ার্ড কমপক্ষে ৮ অক্ষরের হতে হবে। Password must be at least 8 characters." };
  if (password !== confirm) return { error: "পাসওয়ার্ড দুটি মেলেনি। Passwords do not match." };

  let supabase;
  try { supabase = createClient(); } catch (e) { return { error: e.message }; }
  // NOTE: only full_name is sent. No role is ever sent or read from metadata;
  // the DB trigger public.handle_new_user() always creates role = 'user'.
  const site = process.env.NEXT_PUBLIC_SITE_URL || "";
  const { data, error } = await supabase.auth.signUp({
    email, password,
    options: { data: { full_name }, ...(site ? { emailRedirectTo: `${site}/login` } : {}) },
  });
  if (error) return { error: "অ্যাকাউন্ট তৈরি করা যায়নি। Could not create the account (the email may already be registered)." };
  if (data.session) redirect("/dashboard"); // email confirmation disabled
  return { ok: "অ্যাকাউন্ট তৈরি হয়েছে। ইমেইল নিশ্চিত করার পর লগইন করুন। Account created; confirm your email, then sign in." };
}
