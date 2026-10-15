import ToolTile from "@/components/ToolTile";

export default function VerifyTools() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <ToolTile href="/verify/land" title="জমি ও মালিকানা যাচাই" en="Land & ownership check" text="খতিয়ান, মালিক, দাগ, অংশ, পূর্ববর্তী বিক্রয়, অবশিষ্ট জমি ও সরকারি স্বার্থ।" />
      <ToolTile href="/verify/person" title="NID / ব্যক্তি যাচাই" en="Person verification" text="NID নম্বর ও জন্মতারিখ দিয়ে রেকর্ড দেখুন।" />
      <ToolTile href="/verify/deed" title="দলিল যাচাই" en="Deed lookup" text="দলিল নম্বর ও তারিখ দিয়ে অনুসন্ধান।" />
      <ToolTile href="/verify/warish" title="ওয়ারিশ সার্টিফিকেট" en="Warish certificate" text="সার্টিফিকেট নম্বর দিয়ে ওয়ারিশদের তালিকা দেখুন।" />
      <ToolTile href="/verify/challan" title="ই-চালান যাচাই" en="E-challan check" text="চালান নম্বর, পরিমাণ ও ফি-এর ধরন মিলিয়ে দেখুন (ব্যবহৃত হিসেবে চিহ্নিত করে না)।" />
    </div>
  );
}
