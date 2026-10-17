import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
    const { data: profile } = await supabase.from("profiles").select("role,is_approved").eq("id", user.id).maybeSingle();
    if (!profile || profile.role !== "data_entry_operator" || profile.is_approved !== true)
      return NextResponse.json({ error: "Approved Data Entry Operator access required." }, { status: 403 });
    const body = await request.json();
    if (!body || !["echallans","nid_persons","warish_certs","name_attestations","khatians"].includes(body.table) || !body.record || typeof body.record !== "object" || Array.isArray(body.record))
      return NextResponse.json({ error: "Invalid form data." }, { status: 400 });
    const { data, error } = await supabase.rpc("data_entry_insert_record", { p_table: body.table, p_record: body.record });
    if (error) {
      if (error.message?.includes("DUPLICATE_RECORD")) {
        return NextResponse.json({ error: "এই পরিচিতি/নম্বরটি ডাটাবেজে আগে থেকেই আছে। তথ্যটি যাচাই করুন।" }, { status: 409 });
      }
      if (error.message?.includes("PERSON_NAME_NOT_FOUND") || error.message?.includes("HEIR_NAME_NOT_FOUND")) {
        return NextResponse.json({ error: "এই নামে NID ব্যক্তির তথ্য পাওয়া যায়নি। আগে NID / ব্যক্তির তথ্য অংশে ব্যক্তিটিকে যোগ করুন এবং নামের বানান মিলিয়ে দিন।" }, { status: 422 });
      }
      if (error.message?.includes("PERSON_NAME_AMBIGUOUS") || error.message?.includes("HEIR_NAME_AMBIGUOUS")) {
        return NextResponse.json({ error: "একই নামে একাধিক NID রেকর্ড আছে। সঠিক ব্যক্তিকে আলাদা নামে শনাক্ত না করা পর্যন্ত এই তথ্য যোগ করা যাবে না।" }, { status: 422 });
      }
      console.error("Manual data entry failed:", error.code, error.message);
      return NextResponse.json({ error: error.message || "Insert failed. Check migration 25 and required fields." }, { status: 400 });
    }
    return NextResponse.json({ success: true, message: body.table === "echallans" ? "চালানটি তৈরি ও সংরক্ষণ হয়েছে।" : body.table === "warish_certs" ? "ওয়ারিশ সনদ নম্বর তৈরি করে তথ্য সংরক্ষণ হয়েছে।" : body.table === "name_attestations" ? "প্রত্যয়ন নম্বর তৈরি করে তথ্য সংরক্ষণ হয়েছে।" : body.table === "khatians" ? "পর্চা, মালিক ও দাগের তথ্য সংরক্ষণ হয়েছে।" : "তথ্য সফলভাবে ডাটাবেজে যোগ হয়েছে.", data });
  } catch {
    return NextResponse.json({ error: "Request could not be processed." }, { status: 400 });
  }
}
