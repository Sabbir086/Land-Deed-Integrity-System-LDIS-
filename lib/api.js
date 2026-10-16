import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// All approved roles can access read-only verification APIs.
// Application ownership and write permissions remain protected
// by the separate application RPCs and database rules.
export function verifyRoute(rpcName, parse, after) {
  return async function POST(request) {
    let body;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON" },
        { status: 400 }
      );
    }

    let supabase;

    try {
      supabase = createClient();
    } catch (e) {
      return NextResponse.json(
        { error: e.message },
        { status: 500 }
      );
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Please sign in." },
        { status: 401 }
      );
    }

    const { data: profile, error: profileError } =
      await supabase
        .from("profiles")
        .select("role,is_approved")
        .eq("id", user.id)
        .maybeSingle();

    if (
      profileError ||
      !profile ||
      profile.is_approved !== true
    ) {
      return NextResponse.json(
        { error: "Approved account required." },
        { status: 403 }
      );
    }

    // Permit every supported application role.
    if (
      !["user", "admin", "sub_registrar"].includes(
        profile.role
      )
    ) {
      return NextResponse.json(
        { error: "Your account is not allowed to do this." },
        { status: 403 }
      );
    }

    let args;

    try {
      args = parse(body);
    } catch (e) {
      return NextResponse.json(
        { error: e.message },
        { status: 422 }
      );
    }

    const { data, error } = await supabase.rpc(
      rpcName,
      args
    );

    if (error) {
      console.error(
        `[rpc ${rpcName}]`,
        error.code,
        error.message
      );

      const status =
        error.code === "28000"
          ? 401
          : error.code === "42501"
            ? 403
            : error.code === "22023"
              ? 422
              : error.code === "PGRST202"
                ? 501
                : 500;

      const msg =
        status === 501
          ? "Verification function is not installed yet. Run supabase/migrations/06_verification_rpcs.sql."
          : status === 422
            ? "The values entered are not valid."
            : status === 403
              ? "Your account is not allowed to do this."
              : status === 401
                ? "Please sign in."
                : "Lookup failed. Please try again.";

      return NextResponse.json(
        { error: msg },
        { status }
      );
    }

    return NextResponse.json({
      data: after ? after(data, body) : data,
    });
  };
}
