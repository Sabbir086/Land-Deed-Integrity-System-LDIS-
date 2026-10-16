"use client";
import { useEffect, useState } from "react";
import { Alert, Button, Card } from "@/components/ui";
import { createClient } from "@/lib/supabase/browser";

const SUPER_ADMIN_EMAIL = "joysabbir086@gmail.com";

export default function UserApprovalPanel() {
  const [users,setUsers]=useState([]), [roles,setRoles]=useState({}), [jurisdictions,setJurisdictions]=useState({});
  const [options,setOptions]=useState([]), [loading,setLoading]=useState(true), [busy,setBusy]=useState("");
  const [message,setMessage]=useState(""), [error,setError]=useState(""), [currentEmail,setCurrentEmail]=useState("");

  async function load() {
    setLoading(true); setError("");
    const {data,error:rpcError}=await createClient().rpc("admin_list_users");
    if(rpcError) setError("ব্যবহারকারীর তালিকা লোড হয়নি। Migration 11–13 পরীক্ষা করুন।");
    else {
      const rows=Array.isArray(data)?data:[];
      setUsers(rows); setRoles(Object.fromEntries(rows.map(u=>[u.id,u.role||"user"])));
      setJurisdictions(Object.fromEntries(rows.map(u=>[u.id,{district:u.district||"",upazila:u.upazila||""}])));
    }
    setLoading(false);
  }
  useEffect(()=>{
    const supabase=createClient();
    supabase.auth.getUser().then(({data})=>setCurrentEmail((data?.user?.email||"").toLowerCase()));
    load();
    (async()=>{
      const {data:divisions}=await supabase.rpc("verify_location_options",{p_level:"division",p_division:null,p_district:null,p_upazila:null});
      const all=[];
      for(const division of (Array.isArray(divisions)?divisions:[])){
        const {data:districts}=await supabase.rpc("verify_location_options",{p_level:"district",p_division:division,p_district:null,p_upazila:null});
        for(const district of (Array.isArray(districts)?districts:[])){
          const {data:upazilas}=await supabase.rpc("verify_location_options",{p_level:"upazila",p_division:division,p_district:district,p_upazila:null});
          for(const upazila of (Array.isArray(upazilas)?upazilas:[])) all.push({division,district,upazila});
        }
      }
      setOptions(all);
    })();
  },[]);
  const isSuperAdmin=currentEmail===SUPER_ADMIN_EMAIL;

  async function save(user) {
    setBusy(user.id); setMessage(""); setError("");
    const role=roles[user.id]||"user", jurisdiction=jurisdictions[user.id]||{};
    if(role==="sub_registrar" && (!jurisdiction.district || !jurisdiction.upazila)) {
      setError("সাব-রেজিস্ট্রার নির্বাচিত হলে দায়িত্বপ্রাপ্ত জেলা ও উপজেলা নির্বাচন করতে হবে।"); setBusy(""); return;
    }
    const supabase=createClient();
    const {error:roleError}=await supabase.rpc("admin_set_user_access",{p_user_id:user.id,p_role:role,p_approved:!user.is_approved});
    if(roleError) {setError(roleError.message||"অনুমোদন পরিবর্তন করা যায়নি।");setBusy("");return;}
    if(role==="sub_registrar") {
      const {error:jurisdictionError}=await supabase.rpc("admin_set_sub_registrar_jurisdiction",{p_user_id:user.id,p_district:jurisdiction.district,p_upazila:jurisdiction.upazila});
      if(jurisdictionError) {setError(jurisdictionError.message||"উপজেলা বরাদ্দ করা যায়নি।");setBusy("");await load();return;}
    }
    setMessage(`${user.email}-এর তথ্য আপডেট হয়েছে।`); await load(); setBusy("");
  }

  async function saveRole(user) {
    setBusy(user.id); setMessage(""); setError("");
    const role=roles[user.id]||"user", jurisdiction=jurisdictions[user.id]||{};
    if(role==="sub_registrar" && (!jurisdiction.district || !jurisdiction.upazila)) {setError("সাব-রেজিস্ট্রারের জন্য জেলা ও উপজেলা নির্বাচন করুন।");setBusy("");return;}
    const {error:roleError}=await createClient().rpc("admin_set_user_access",{p_user_id:user.id,p_role:role,p_approved:user.is_approved});
    if(roleError) {setError(roleError.message||"Role update failed.");setBusy("");return;}
    if(role==="sub_registrar") {
      const {error:jurisdictionError}=await createClient().rpc("admin_set_sub_registrar_jurisdiction",{p_user_id:user.id,p_district:jurisdiction.district,p_upazila:jurisdiction.upazila});
      if(jurisdictionError) {setError(jurisdictionError.message||"উপজেলা বরাদ্দ করা যায়নি।");setBusy("");await load();return;}
    }
    setMessage(`${user.email}-এর role ও দায়িত্ব আপডেট হয়েছে।`); await load(); setBusy("");
  }

  return <Card title="User Approval">
    {message&&<Alert tone="success">{message}</Alert>}{error&&<Alert tone="error">{error}</Alert>}
    {loading?<p className="text-sm text-slate-500">ব্যবহারকারীর তালিকা লোড হচ্ছে…</p>:<div className="overflow-x-auto">
      <table className="w-full text-sm"><thead><tr className="border-b text-left"><th className="p-2">নাম / ইমেইল</th><th className="p-2">Role</th><th className="p-2">দায়িত্বপ্রাপ্ত উপজেলা</th><th className="p-2">অবস্থা</th><th className="p-2">কাজ</th></tr></thead><tbody>
        {users.map(u=>{const isLocked=u.email?.toLowerCase()===SUPER_ADMIN_EMAIL;const j=jurisdictions[u.id]||{};const matching=options.filter(o=>!j.district||o.district===j.district);return <tr key={u.id} className="border-b align-top">
          <td className="p-2"><div className="font-semibold">{u.full_name||"—"}</div><div className="break-all text-xs text-slate-500">{u.email}</div></td>
          <td className="p-2"><select aria-label={`Role for ${u.email}`} className="max-w-40 rounded-lg border p-2" disabled={!isSuperAdmin||isLocked} value={roles[u.id]||"user"} onChange={e=>setRoles(old=>({...old,[u.id]:e.target.value}))}><option value="user">User</option><option value="sub_registrar">Sub-Registrar</option><option value="admin">Admin</option></select></td>
          <td className="min-w-56 p-2">{(roles[u.id]||u.role)==="sub_registrar"?<div className="space-y-2">
            <select className="w-full rounded-lg border p-2" value={j.district||""} onChange={e=>setJurisdictions(old=>({...old,[u.id]:{district:e.target.value,upazila:""}}))}><option value="">জেলা নির্বাচন</option>{[...new Set(options.map(o=>o.district))].sort().map(d=><option key={d}>{d}</option>)}</select>
            <select className="w-full rounded-lg border p-2" value={j.upazila||""} onChange={e=>setJurisdictions(old=>({...old,[u.id]:{...j,upazila:e.target.value}}))}><option value="">উপজেলা নির্বাচন</option>{[...new Set(matching.map(o=>o.upazila))].sort().map(up=><option key={up}>{up}</option>)}</select>
            <span className="block text-xs text-slate-500">এক উপজেলায় একজন সাব-রেজিস্ট্রার।</span>
          </div>:<span className="text-slate-400">প্রযোজ্য নয়</span>}</td>
          <td className="p-2">{u.is_approved?<span className="font-semibold text-emerald-700">অনুমোদিত</span>:<span className="font-semibold text-amber-700">অপেক্ষমাণ</span>}</td>
          <td className="p-2"><div className="flex min-w-32 flex-col gap-2">{isSuperAdmin&&!isLocked&&<Button type="button" disabled={busy===u.id} onClick={()=>saveRole(u)}>{busy===u.id?"সংরক্ষণ…":"Role সংরক্ষণ"}</Button>}<Button type="button" disabled={busy===u.id||isLocked} onClick={()=>save(u)}>{u.is_approved?"অনুমোদন বাতিল":"অনুমোদন"}</Button>{!isSuperAdmin&&u.role==="sub_registrar"&&<Button type="button" variant="secondary" disabled={busy===u.id} onClick={()=>saveRole(u)}>উপজেলা Transfer</Button>}</div></td>
        </tr>})}
        {!users.length&&<tr><td colSpan="5" className="p-3 text-slate-500">কোনো ব্যবহারকারী পাওয়া যায়নি।</td></tr>}
      </tbody></table>
    </div>}
  </Card>;
}
