"use client";
import { useCallback, useState } from "react";

// Calls our own /api/verify/* routes (never Supabase ref tables). Returns { data } or { error }.
export async function callApi(path, body) {
  try {
    const res = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const json = await res.json().catch(() => ({}));
    if (res.status === 401) { window.location.href = "/login"; return { error: "Please sign in." }; }
    if (!res.ok) return { error: json.error || "Request failed." };
    return { data: json.data };
  } catch {
    return { error: "নেটওয়ার্ক সমস্যা। Network error, please try again." };
  }
}

export function useLookup() {
  const [state, setState] = useState({ loading: false, error: null, data: null });
  const run = useCallback(async (path, body) => {
    setState({ loading: true, error: null, data: null });
    const r = await callApi(path, body);
    setState({ loading: false, error: r.error || null, data: r.data ?? null });
    return r;
  }, []);
  const reset = useCallback(() => setState({ loading: false, error: null, data: null }), []);
  return [state, run, reset];
}
