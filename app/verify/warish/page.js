import { requireVerifier } from "@/lib/verify-page";
import { Disclaimer, PageHeader } from "@/components/ui";
import WarishLookup from "@/components/verify/WarishLookup";

export const dynamic = "force-dynamic";

export const metadata = { title: "ওয়ারিশ সার্টিফিকেট যাচাই" };

export default async function Page() {
  await requireVerifier();
  return (
    <>
      <PageHeader title="ওয়ারিশ সার্টিফিকেট যাচাই" titleEn="Warish certificate" description="সার্টিফিকেট নম্বর দিয়ে মৃত ব্যক্তি ও ওয়ারিশদের তালিকা দেখুন।" />
      <div className="space-y-4"><Disclaimer /><WarishLookup /></div>
    </>
  );
}
