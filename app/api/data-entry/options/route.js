import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const VALID_LEVELS = new Set(["division", "district", "upazila", "mouza"]);

export async function POST(request) {
  try {
    const body = await request.json();
    if (!body || !VALID_LEVELS.has(body.level)) {
      return NextResponse.json({ error: "অবস্থানের স্তর সঠিক নয়।" }, { status: 422 });
    }

    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role,is_approved")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError || profile?.role !== "data_entry_operator" || profile?.is_approved !== true) {
      return NextResponse.json({ error: "Approved Data Entry Operator access required." }, { status: 403 });
    }

    const { data, error } = await supabase.rpc("data_entry_location_options", {
      p_level: body.level,
      p_division: body.division || null,
      p_district: body.district || null,
      p_upazila: body.upazila || null
    });

    if (error) {
      console.error("Data-entry location options failed:", error.code, error.message);
      return NextResponse.json({ error: "অবস্থানের তালিকা লোড করা যায়নি। Migration 25 চালু আছে কি না দেখুন।" }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch {
    return NextResponse.json({ error: "Request could not be processed." }, { status: 400 });
  }
}
