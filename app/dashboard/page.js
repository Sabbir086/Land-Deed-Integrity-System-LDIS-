import { requireRole } from "@/lib/auth";
import { Alert, Card, PageHeader } from "@/components/ui";
import ProfileCard from "@/components/ProfileCard";
import ToolTile from "@/components/ToolTile";
import VerifyTools from "@/components/verify/Tools";
import { createClient } from "@/lib/supabase/server";
import NewApplicationButton from "@/components/applications/NewApplicationButton";
import { NotificationList } from "@/components/applications/DetailActions";
import { statusMeta } from "@/lib/applications/status";

export const metadata = { title: "ব্যবহারকারী ড্যাশবোর্ড" };

export default async function UserDashboard() {
  const { profile } = await requireRole(["user"]);
  const supabase = createClient();
  // Both reads are protected by RLS (own rows only). Failures (migrations not installed) degrade to empty.
  const [{ data: apps }, { data: notes }] = await Promise.all([
    supabase.from("deed_applications").select("status"),
    supabase.from("user_notifications").select("id,title_bn,title_en,created_at,read_at").order("created_at", { ascending: false }).limit(8),
  ]);
  const counts = {}; (apps || []).forEach((a) => { counts[a.status] = (counts[a.status] || 0) + 1; });
  return (
    <>
      <PageHeader title="ব্যবহারকারী ড্যাশবোর্ড" titleEn="User dashboard" description={`স্বাগতম, ${profile.full_name || profile.email}।`} />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <section aria-labelledby="tools"><h2 id="tools" className="mb-3 text-lg font-semibold">যাচাই সেবা <span className="text-sm font-normal text-slate-500">Verification tools (functional)</span></h2><VerifyTools /></section>
          <section aria-labelledby="apps"><h2 id="apps" className="mb-3 text-lg font-semibold">আবেদন <span className="text-sm font-normal text-slate-500">Applications</span></h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Card title="নতুন দলিলের আবেদন" subtitle="Apply for Deed"><p className="mb-3 text-sm text-slate-600">ধাপে ধাপে আবেদন; প্রতিটি ধাপে সংরক্ষণ করে পরে চালিয়ে যাওয়া যায়।</p><NewApplicationButton /></Card>
              <ToolTile href="/dashboard/applications" title="আমার আবেদনসমূহ" en="My applications" text={Object.keys(counts).length ? Object.entries(counts).map(([s, n]) => `${statusMeta(s).bn}: ${n}`).join(" · ") : "এখনো কোনো আবেদন নেই।"} />
            </div>
          </section>
        </div>
        <div className="space-y-4"><ProfileCard profile={profile} />
          <Card title="বিজ্ঞপ্তি · Notifications"><NotificationList items={notes || []} /></Card>
        </div>
      </div>
      <div className="mt-6"><Alert tone="info">সাব-রেজিস্ট্রারের পর্যালোচনা, বায়োমেট্রিক গ্রহণ ও নিবন্ধন পরবর্তী ধাপে (Stage 3) যুক্ত হবে। Registrar review, biometric capture and registration arrive in Stage 3.</Alert></div>
    </>
  );
}
