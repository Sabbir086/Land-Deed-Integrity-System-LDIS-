import { Badge, Card } from "@/components/ui";
import { ROLE_LABEL } from "@/lib/roles";
import { fmtDate } from "@/lib/utils";

export default function ProfileCard({ profile }) {
  const rows = [
    ["নাম · Name", profile.full_name || "—"],
    ["ইমেইল · Email", profile.email || "—"],
    ["ভূমিকা · Role", <Badge key="r" tone={profile.role === "admin" ? "purple" : profile.role === "sub_registrar" ? "blue" : "green"}>{ROLE_LABEL[profile.role]?.bn} ({profile.role})</Badge>],
    ...(profile.role === "sub_registrar" ? [["জেলা · District", profile.district || "—"], ["উপজেলা · Upazila", profile.upazila || "—"]] : []),
    ["যোগদান · Joined", fmtDate(profile.created_at)],
  ];
  return (
    <Card title="প্রোফাইল" subtitle="Read from public.profiles (read-only)">
      <dl className="grid grid-cols-[auto,1fr] gap-x-4 gap-y-2 text-sm">
        {rows.map(([k, v]) => (<div key={k} className="contents"><dt className="text-slate-500">{k}</dt><dd className="font-medium">{v}</dd></div>))}
      </dl>
    </Card>
  );
}
