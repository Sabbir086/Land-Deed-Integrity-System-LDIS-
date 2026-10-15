import { requireVerifier } from "@/lib/verify-page";
import { Disclaimer, PageHeader } from "@/components/ui";
import LandWorkbench from "@/components/verify/LandWorkbench";

export const dynamic = "force-dynamic";

export const metadata = { title: "জমি ও মালিকানা যাচাই" };

export default async function Page() {
  await requireVerifier();
  return (
    <>
      <PageHeader title="জমি ও মালিকানা যাচাই" titleEn="Land & ownership verification" description="খতিয়ান খুঁজে মালিক, দাগ, অংশ, পূর্ববর্তী বিক্রয় ও সরকারি স্বার্থ দেখুন।" />
      <div className="space-y-4"><Disclaimer /><LandWorkbench /></div>
    </>
  );
}
