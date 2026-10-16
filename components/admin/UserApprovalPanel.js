"use client";
import { useEffect, useState } from "react";
import { Alert, Button, Card } from "@/components/ui";
import { createClient } from "@/lib/supabase/browser";

export default function UserApprovalPanel() {
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [currentEmail, setCurrentEmail] = useState("");
  const SUPER_ADMIN_EMAIL = "joysabbir086@gmail.com";

  async function load() {
    setLoading(true); setError("");
    const { data, error: rpcError } = await createClient().rpc("admin_list_users");
    if (rpcError) setError("User list could not be loaded. Apply migration 11 and refresh.");
    else {
      const rows = Array.isArray(data) ? data : [];
      setUsers(rows);
      setRoles(Object.fromEntries(rows.map((u) => [u.id, u.role || "user"])));
    }
    setLoading(false);
  }
  useEffect(() => {
    createClient().auth.getUser().then(({ data }) => setCurrentEmail((data?.user?.email || "").toLowerCase()));
    load();
  }, []);
  const isSuperAdmin = currentEmail === SUPER_ADMIN_EMAIL;

  async function save(user) {
    setBusy(user.id); setMessage(""); setError("");
    const { error: rpcError } = await createClient().rpc("admin_set_user_access", {
      p_user_id: user.id,
      p_role: roles[user.id] || "user",
      p_approved: !user.is_approved,
    });
    if (rpcError) setError(rpcError.message || "Could not update user access.");
    else { setMessage(`Access updated for ${user.email}.`); await load(); }
    setBusy("");
  }

  async function saveRole(user) {
    setBusy(user.id); setMessage(""); setError("");
    const { error: rpcError } = await createClient().rpc("admin_set_user_access", {
      p_user_id: user.id,
      p_role: roles[user.id] || "user",
      p_approved: user.is_approved,
    });
    if (rpcError) setError(rpcError.message || "Could not update user role.");
    else { setMessage(`Role updated for ${user.email}.`); await load(); }
    setBusy("");
  }

  return <Card title="User approval & role management" subtitle="Approve registrations and assign User, Sub-Registrar or Admin access">
    {message && <Alert tone="success">{message}</Alert>}{error && <Alert tone="error">{error}</Alert>}
    {loading ? <p className="text-sm text-slate-500">Loading users…</p> : <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left"><th className="p-2">Name / Email</th><th className="p-2">Role</th><th className="p-2">Status</th><th className="p-2">Actions</th></tr></thead><tbody>
      {users.map((u) => <tr key={u.id} className="border-b align-top"><td className="p-2"><div className="font-medium">{u.full_name || "—"}</div><div className="break-all text-xs text-slate-600">{u.email}</div></td><td className="p-2"><select aria-label={`Role for ${u.email}`} className="rounded border p-2" disabled={!isSuperAdmin || u.email?.toLowerCase() === SUPER_ADMIN_EMAIL} value={roles[u.id] || "user"} onChange={(e) => setRoles((old) => ({ ...old, [u.id]: e.target.value }))}><option value="user">User</option><option value="sub_registrar">Sub-Registrar</option><option value="admin">Admin</option></select></td><td className="p-2">{u.is_approved ? <span className="font-medium text-green-700">Approved</span> : <span className="font-medium text-amber-700">Pending</span>}</td><td className="p-2"><div className="flex flex-wrap gap-2">{isSuperAdmin && u.email?.toLowerCase() !== SUPER_ADMIN_EMAIL && <Button type="button" disabled={busy === u.id} onClick={() => saveRole(u)}>{busy === u.id ? "Saving…" : "Save role"}</Button>}<Button type="button" disabled={busy === u.id} onClick={() => save(u)}>{u.is_approved ? "Revoke approval" : "Approve"}</Button></div></td></tr>)}
      {!users.length && <tr><td colSpan="4" className="p-3 text-slate-500">No profiles found.</td></tr>}
    </tbody></table></div>}
    <p className="mt-3 text-xs text-slate-500">Only <strong>joysabbir086@gmail.com</strong> can change account roles or grant Admin access. Other Admin accounts can approve/revoke user and Sub-Registrar access only. The Super Admin role is locked and cannot be changed from this list. Sub-Registrars need their district/upazila assigned.</p>
  </Card>;
}
