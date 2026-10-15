import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
import { createClient } from "@/lib/supabase/server";

export async function POST(request) {
  try { await createClient().auth.signOut(); } catch {}
  return NextResponse.redirect(new URL("/login", request.url), { status: 303 });
}
