import { Alert, Badge, DataTable } from "@/components/ui";
import { fmtMoney } from "@/lib/applications/format";
import { FEE_TYPE_LABEL } from "@/lib/applications/status";

export default function FeeTable({ items, total }) {
  if (!items?.length) return <Alert tone="info">মূল্য দিলে ফি-এর হিসাব এখানে দেখাবে। Fees appear once a sale price is saved.</Alert>;
  const demo = items.some((i) => i.is_demo);
  return (
    <div className="space-y-3">
      <DataTable caption="Fee breakdown" rows={items} columns={[
        { key: "name_bn", label: "ফি-এর নাম", render: (r) => <span>{r.name_bn}<span className="block text-xs text-slate-500">{r.name_en}</span></span> },
        { key: "rate_percent", label: "হার", render: (r) => `${Number(r.rate_percent)}%${Number(r.fixed_amount) ? ` + ${fmtMoney(r.fixed_amount)}` : ""}` },
        { key: "basis", label: "গণনার ভিত্তি", render: (r) => `বিক্রয়মূল্য ${fmtMoney(r.base_amount)}` },
        { key: "amount", label: "প্রদেয়", render: (r) => <span className="font-semibold">{fmtMoney(r.amount)}</span> },
        { key: "challan_type", label: "চালান", render: (r) => FEE_TYPE_LABEL[r.challan_type]?.bn || r.challan_type },
      ]} />
      <p className="text-right text-sm font-semibold">মোট · Total: {fmtMoney(total ?? items.reduce((s, i) => s + Number(i.amount), 0))}</p>
      {demo && <Alert tone="warn" title="ডেমো হার · Demo rates"><Badge tone="amber">DEMO</Badge> এগুলো প্রকল্প-নথির নমুনা হার, সরকারি হার নয়। হার/ভিত্তি/ন্যূনতম ফি নিশ্চিত হলে <code>public.fee_config</code> আপডেট করতে হবে। These are sample rates from the project document, not official government rates.</Alert>}
    </div>
  );
}
