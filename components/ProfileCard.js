import { Badge, Card } from "@/components/ui";
import { ROLE_LABEL } from "@/lib/roles";
import { fmtDate } from "@/lib/utils";

export default function ProfileCard({ profile }) {
  return <Card className="overflow-hidden" title="প্রোফাইল">
    <div className="mb-4 rounded-xl bg-gradient-to-r from-slate-900 to-slate-700 p-4 text-white">
      <p className="text-lg font-bold">{profile.full_name || profile.email || "ব্যবহারকারী"}</p>
      <p className="mt-1 text-sm text-slate-200">{ROLE_LABEL[profile.role]?.bn || profile.role}</p>
      {profile.role === "sub_registrar" && <p className="mt-1 text-xs text-cyan-200">দায়িত্বপ্রাপ্ত উপজেলা: {profile.upazila || "বরাদ্দ হয়নি"}</p>}
    </div>
    <dl className="space-y-3 text-sm">
      <div><dt className="text-slate-500">ইমেইল</dt><dd className="break-all font-medium">{profile.email || "—"}</dd></div>
      {profile.role === "sub_registrar" && <div><dt className="text-slate-500">জেলা / উপজেলা</dt><dd className="font-medium">{profile.district || "—"} / {profile.upazila || "বরাদ্দ হয়নি"}</dd></div>}
      <div><dt className="text-slate-500">যোগদান</dt><dd className="font-medium">{fmtDate(profile.created_at)}</dd></div>
    </dl>
  </Card>;
}
