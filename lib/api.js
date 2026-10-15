import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Factory for POST route handlers that call ONE narrow RPC with the visitor's own session.
// Authorization is enforced twice: here (must be signed in) and inside the RPC (ref.assert_app_user()).
export function verifyRoute(rpcName, parse, after) {
  return async function POST(request) {
    let body;
    try { body = await request.json(); }
    catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

    let supabase;
    try { supabase = createClient(); }
    catch (e) { return NextResponse.json({ error: e.message }, { status: 500 }); }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });

    let args;
    try { args = parse(body); }
    catch (e) { return NextResponse.json({ error: e.message }, { status: 422 }); }

    const { data, error } = await supabase.rpc(rpcName, args);
    if (error) {
      console.error(`[rpc ${rpcName}]`, error.code, error.message); // never returned to the browser
      const status = error.code === "28000" ? 401 : error.code === "42501" ? 403 : error.code === "22023" ? 422 : error.code === "PGRST202" ? 501 : 500;
      const msg = status === 501
        ? "Verification function is not installed yet. Run supabase/migrations/06_verification_rpcs.sql."
        : status === 422 ? "The values entered are not valid." : status === 403 ? "Your account is not allowed to do this." : status === 401 ? "Please sign in." : "Lookup failed. Please try again.";
      return NextResponse.json({ error: msg }, { status });
    }
    return NextResponse.json({ data: after ? after(data, body) : data });
  };
}
