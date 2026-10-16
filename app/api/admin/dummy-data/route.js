import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
const SUPER_ADMIN = "joysabbir086@gmail.com";
const ALLOWED_TABLES = new Set([
  "nid_persons", "locations", "khatians", "khatian_owners", "khatian_dags", "khas_govt",
  "warish_certs", "warish_heirs", "name_attestations", "echallans", "deeds",
]);

export async function POST(request) {
  try {
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Please sign in." }, { status: 401 });
    }
    if (user.email?.toLowerCase() !== SUPER_ADMIN) {
      return NextResponse.json({ error: "Super Admin access required." }, { status: 403 });
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles").select("role,is_approved").eq("id", user.id).maybeSingle();
    if (profileError || !profile || profile.role !== "admin" || profile.is_approved !== true) {
      return NextResponse.json({ error: "Approved Super Admin access required." }, { status: 403 });
    }

    const body = await request.json();
    const { table, rows } = body || {};
    if (!ALLOWED_TABLES.has(table) || !Array.isArray(rows) || rows.length < 1 || rows.length > 500 || rows.some((row) => !row || typeof row !== "object" || Array.isArray(row))) {
      return NextResponse.json({ error: "Invalid table or record count." }, { status: 400 });
    }

    const { data, error } = await supabase.rpc("super_admin_import_dummy_data", { p_table: table, p_rows: rows });
    if (error) {
      console.error("Dummy data import failed:", error.code, error.message);
      return NextResponse.json({ error: "Import failed. Check JSON fields, relationships, and migration 14." }, { status: 400 });
    }
    return NextResponse.json({ success: true, inserted: data?.inserted ?? 0 });
  } catch {
    return NextResponse.json({ error: "Could not process the upload." }, { status: 400 });
  }
}
