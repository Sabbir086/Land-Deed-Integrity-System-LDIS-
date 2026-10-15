import Link from "next/link";
import { Alert } from "@/components/ui";
import { safeNext } from "@/lib/safe-redirect";

export const metadata = { title: "প্রবেশ নিষেধ" };

export default function AccessDenied({ searchParams }) {
  const noProfile = searchParams?.reason === "no-profile";
  const home = safeNext(searchParams?.home, "/");
  return (
    <div className="mx-auto max-w-xl space-y-4 py-8">
      <Alert tone="error" title="প্রবেশের অনুমতি নেই · Access denied">
        {noProfile
          ? "আপনার অ্যাকাউন্টের সঙ্গে কোনো প্রোফাইল যুক্ত নেই। প্রশাসকের সঙ্গে যোগাযোগ করুন। Your account has no profile row."
          : "এই পৃষ্ঠা দেখার জন্য আপনার ভূমিকার অনুমতি নেই। Your role is not permitted to view this page."}
      </Alert>
      <Link href={home} className="inline-block rounded-md bg-brand-700 px-4 py-2 text-sm font-semibold text-white">আপনার ড্যাশবোর্ডে ফিরুন</Link>
    </div>
  );
}
