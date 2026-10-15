import { requireVerifier } from "@/lib/verify-page";
import { Disclaimer, PageHeader } from "@/components/ui";
import DeedLookup from "@/components/verify/DeedLookup";

export const dynamic = "force-dynamic";

export const metadata = { title: "দলিল যাচাই" };

export default async function Page() {
  await requireVerifier();
  return (
    <>
      <PageHeader title="দলিল যাচাই" titleEn="Deed lookup" description="দলিল নম্বর ও তারিখ দিয়ে দলিলের তথ্য দেখুন।" />
      <div className="space-y-4"><Disclaimer /><DeedLookup /></div>
    </>
  );
}
