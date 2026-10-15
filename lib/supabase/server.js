import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabaseEnv } from "@/lib/env";

// Server-side client bound to the visitor's session (role = anon / authenticated).
// It never uses a service_role key; the database enforces access through RLS and RPC checks.
export function createClient() {
  const { url, anonKey } = getSupabaseEnv();
  const cookieStore = cookies();
  return createServerClient(url, anonKey, {
    cookies: {
      getAll() { return cookieStore.getAll(); },
      setAll(list) {
        try { list.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); }
        catch { /* called from a Server Component: middleware refreshes the session instead */ }
      },
    },
  });
}
