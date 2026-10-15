import { requireVerifier } from "@/lib/verify-page";
import { Disclaimer, PageHeader } from "@/components/ui";
import PersonLookup from "@/components/verify/PersonLookup";

export const dynamic = "force-dynamic";

export const metadata = { title: "NID / ব্যক্তি যাচাই" };

export default async function Page() {
  await requireVerifier();
  return (
    <>
      <PageHeader title="NID / ব্যক্তি যাচাই" titleEn="Person verification" description="NID নম্বর ও জন্মতারিখ দিয়ে প্রকল্পের নিজস্ব রেকর্ড দেখুন।" />
      <div className="space-y-4"><Disclaimer /><PersonLookup /></div>
    </>
  );
}
