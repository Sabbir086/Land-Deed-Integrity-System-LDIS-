import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
const allowed = new Set(["queue", "detail", "decision", "finalize", "summary", "checklist"]);
export async function GET(request, { params }) {
  if (params.action !== "checklist") return NextResponse.json({error:"Unknown action"},{status:404});
  const supabase=createClient();
  const {data:{user},error:authError}=await supabase.auth.getUser();
  if(authError||!user)return NextResponse.json({error:"Please sign in."},{status:401});
  const {data:profile}=await supabase.from("profiles").select("role,is_approved").eq("id",user.id).maybeSingle();
  if(!profile||profile.is_approved===false||!["admin","sub_registrar"].includes(profile.role))return NextResponse.json({error:"Staff access required."},{status:403});
  const appId=new URL(request.url).searchParams.get("application_id");
  if(!appId)return NextResponse.json({error:"application_id is required"},{status:400});
  const {data,error}=await supabase.rpc("staff_get_review_checklist",{p_app:appId});
  if(error)return NextResponse.json({error:"Could not load review checklist. Apply the latest additive migration."},{status:500});
  return NextResponse.json({data});
}
export async function POST(request, { params }) {
  const action = params.action;
  if (!allowed.has(action)) return NextResponse.json({ error: "Unknown action" }, { status: 404 });
  const supabase = createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  const { data: profile } = await supabase.from("profiles").select("role,district,upazila,is_approved").eq("id", user.id).maybeSingle();
  if (!profile || profile.is_approved === false || !["admin", "sub_registrar"].includes(profile.role)) return NextResponse.json({ error: "Staff access required." }, { status: 403 });
  if (action === "summary" && profile.role !== "admin") return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  let body = {};
  try { body = await request.json(); } catch {}
  const calls = {
    queue: ["staff_queue", { p_status: body.status || null }],
    detail: ["staff_application_detail", { p_app: body.application_id }],
    decision: ["staff_decide_application", { p_app: body.application_id, p_decision: body.decision, p_note: body.note || "", p_steps: Array.isArray(body.steps) ? body.steps : [] }],
    finalize: ["staff_finalize_registration", { p_app: body.application_id }],
    summary: ["admin_summary", {}],
    checklist: ["staff_save_review_checklist", { p_app: body.application_id, p_items: Array.isArray(body.items) ? body.items : [] }],
  };
  const [rpc, args] = calls[action];
  const { data, error } = await supabase.rpc(rpc, args);
  if (error) {
    console.error(`[staff rpc ${rpc}]`, error.code, error.message);
    const status = error.code === "42501" ? 403 : error.code === "AP001" ? 409 : error.code === "22023" ? 422 : 500;
    return NextResponse.json({ error: status === 500 ? "The operation failed. Check database migrations and server logs." : error.message }, { status });
  }
  return NextResponse.json({ data });
}
