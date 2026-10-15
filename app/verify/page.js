import { requireVerifier } from "@/lib/verify-page";
import { PageHeader } from "@/components/ui";
import VerifyTools from "@/components/verify/Tools";

export const metadata = { title: "যাচাই সেবা" };

export default async function VerifyHub() {
  await requireVerifier();
  return (<><PageHeader title="যাচাই সেবা" titleEn="Verification tools" /><VerifyTools /></>);
}
