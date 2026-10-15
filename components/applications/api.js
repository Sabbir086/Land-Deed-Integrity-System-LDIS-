"use client";
import { callApi } from "@/components/verify/api";
// Thin wrapper: every Stage 2 write goes through /api/applications/<action> (never directly to Supabase tables).
export const appCall = (action, body) => callApi(`/api/applications/${action}`, body);
