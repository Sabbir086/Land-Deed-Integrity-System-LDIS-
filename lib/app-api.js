import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ACTIONS } from "@/lib/applications/schemas";

// Maps database error codes to HTTP. AP001/AP002 messages are authored in the migrations and are safe to show.
export function mapRpcError(error) {
  const code = error?.code;
  if (code === "28000") return [401, "Please sign in."];
  if (code === "42501") return [403, "You are not allowed to do this."];
  if (code === "22023") return [422, "The values entered are not valid."];
  if (code === "AP001") return [409, error.message];
  if (code === "AP002") return [429, error.message];
  if (code === "PGRST202") return [501, "Application functions are not installed yet. Run supabase/migrations/07, 08 and 09."];
  return [500, "The request failed. Please try again."];
}

// POST /api/applications/<action>. Signed-in session required; the RPC runs with the VISITOR'S session
// (no service-role key) and re-checks role, ownership and application state itself.
export async function runAppAction(request, action) {
  const def = Object.prototype.hasOwnProperty.call(ACTIONS, action) ? ACTIONS[action] : null;
  if (!def) return NextResponse.json({ error: "Unknown action" }, { status: 404 });
  let body;
  try { body = await request.json(); } catch { body = {}; }
  if (body === null || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  let supabase;
  try { supabase = createClient(); } catch (e) { return NextResponse.json({ error: e.message }, { status: 500 }); }
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });

  let args;
  try { args = def.parse(body); } catch (e) { return NextResponse.json({ error: e.message }, { status: 422 }); }

  const { data, error } = await supabase.rpc(def.rpc, args);
  if (error) {
    console.error(`[rpc ${def.rpc}]`, error.code, error.message);
    const [status, message] = mapRpcError(error);
    return NextResponse.json({ error: message }, { status });
  }
  return NextResponse.json({ data });
}
