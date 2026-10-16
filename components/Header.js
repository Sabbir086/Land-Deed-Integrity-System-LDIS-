import Link from "next/link";
import { getSessionProfile } from "@/lib/auth";
import { ROLE_LABEL, homeFor } from "@/lib/roles";
import { Button } from "@/components/ui";

export default async function Header() {
  let profile = null;
  try { ({ profile } = await getSessionProfile()); } catch { /* env not configured */ }
  const links = !profile ? [] : [
    { href: homeFor(profile.role), label: "ড্যাশবোর্ড" },
    ...(profile.role === "user" ? [{ href: "/dashboard/applications", label: "আমার আবেদন" }] : [
      { href: "/verify/land", label: "জমি যাচাই" }, { href: "/verify/deed", label: "দলিল যাচাই" },
    ]),
  ];
  return <header className="border-b-4 border-gov-red bg-brand-800 text-white">
    <div className="container-page flex flex-wrap items-center justify-between gap-3 py-3">
      <Link href="/" className="flex items-center gap-3"><span aria-hidden="true" className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-lg font-bold text-brand-800">ভূ</span><span><span className="block text-base font-bold leading-tight">ভূমি দলিল যাচাই ও নিবন্ধন</span><span className="block text-xs text-brand-100">Land Deed Verification &amp; Registration</span></span></Link>
      <nav aria-label="Main" className="flex flex-wrap items-center gap-1 text-sm">
        {links.map((l) => <Link key={l.href} href={l.href} className="rounded px-3 py-2 hover:bg-brand-700">{l.label}</Link>)}
        {profile ? <form action="/auth/signout" method="post" className="ml-2 flex items-center gap-3">
          <span className="hidden text-right sm:block"><span className="block text-xs font-semibold text-white">{profile.full_name || profile.email}</span><span className="block text-[11px] text-brand-100">{ROLE_LABEL[profile.role]?.bn || profile.role}{profile.role === "sub_registrar" && profile.upazila ? ` · ${profile.upazila}` : ""}</span></span>
          <Button variant="secondary" type="submit" className="!min-h-[34px] !py-1">লগআউট</Button>
        </form> : <><Link href="/login" className="rounded px-3 py-2 hover:bg-brand-700">লগইন</Link><Link href="/signup" className="rounded bg-white px-3 py-2 font-semibold text-brand-800 hover:bg-brand-50">নিবন্ধন</Link></>}
      </nav>
    </div>
  </header>;
}
