import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { homeFor } from "@/lib/roles";

// Reuse the same profile lookup within a server render.
export const getSessionProfile = cache(async function getSessionProfile() {
  const supabase = createClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return { user: null, profile: null };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id,email,full_name,role,district,upazila,created_at")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || !profile) {
    return { user, profile: null };
  }

  return { user, profile };
});

// Keep the existing role authorization checks.
export async function requireRole(allowed) {
  const { user, profile } = await getSessionProfile();

  if (!user) {
    redirect("/login");
  }

  if (!profile) {
    redirect("/access-denied?reason=no-profile");
  }

  if (!allowed.includes(profile.role)) {
    redirect(
      `/access-denied?reason=role&home=${encodeURIComponent(
        homeFor(profile.role)
      )}`
    );
  }

  return { user, profile };
}
