import { requireVerifier } from "@/lib/verify-page";
import { Disclaimer, PageHeader } from "@/components/ui";
import ChallanLookup from "@/components/verify/ChallanLookup";

export const metadata = { title: "ই-চালান যাচাই" };

export default async function Page() {
  await requireVerifier();
  return (
    <>
      <PageHeader title="ই-চালান যাচাই" titleEn="E-challan verification" description="চালান নম্বর, পরিমাণ ও ফি-এর ধরন রেকর্ডের সঙ্গে মিলিয়ে দেখুন।" />
      <div className="space-y-4"><Disclaimer /><ChallanLookup /></div>
    </>
  );
}
