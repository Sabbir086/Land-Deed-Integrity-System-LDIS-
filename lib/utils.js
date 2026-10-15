export const cx = (...c) => c.filter(Boolean).join(" ");

const BN = "০১২৩৪৫৬৭৮৯";
// Mirrors ref.bn2en() so client checks agree with the database.
export function bn2en(t) {
  return String(t ?? "").replace(/[০-৯]/g, (d) => String(BN.indexOf(d))).trim();
}
export function toBn(n) {
  return String(n ?? "").replace(/\d/g, (d) => BN[Number(d)]);
}
export const fmtArea = (n) => (n == null ? "—" : `${Number(n).toFixed(4).replace(/0+$/, "").replace(/\.$/, "")} শতক`);
export const fmtDate = (d) => (d ? new Date(d).toLocaleDateString("en-GB", { timeZone: "UTC" }) : "—");
