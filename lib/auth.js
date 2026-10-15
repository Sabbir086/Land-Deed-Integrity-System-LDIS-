import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { homeFor } from "@/lib/roles";

// Returns { user, profile } or nulls. The role ALWAYS comes from public.profiles
// (read through RLS "read own profile"), never from user metadata or form input.
export async function getSessionProfile() {
  const supabase = createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return { user: null, profile: null };
  const { data: profile } = await supabase
    .from("profiles")
    .select("id,email,full_name,role,district,upazila,created_at")
    .eq("id", user.id)
    .maybeSingle();
  return { user, profile: profile || null };
}

// Use at the top of every protected Server Component / layout / route handler.
export async function requireRole(allowed) {
  const { user, profile } = await getSessionProfile();
  if (!user) redirect("/login");
  if (!profile) redirect("/access-denied?reason=no-profile");
  if (!allowed.includes(profile.role)) redirect(`/access-denied?reason=role&home=${encodeURIComponent(homeFor(profile.role))}`);
  return { user, profile };
}
