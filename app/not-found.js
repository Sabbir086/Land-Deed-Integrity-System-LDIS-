import Link from "next/link";
export default function NotFound() {
  return (
    <div className="py-16 text-center">
      <h1 className="text-3xl font-bold">৪০৪ — পৃষ্ঠা পাওয়া যায়নি</h1>
      <p className="mt-2 text-slate-600">Page not found.</p>
      <Link href="/" className="mt-4 inline-block text-brand-700 underline">হোমে ফিরুন</Link>
    </div>
  );
}
