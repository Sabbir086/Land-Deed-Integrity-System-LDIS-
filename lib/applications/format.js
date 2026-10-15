export const fmtMoney = (n) => (n == null ? "—" : `৳ ${Number(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
export const fmtDateTime = (d) => (d ? new Date(d).toLocaleString("en-GB", { timeZone: "Asia/Dhaka", dateStyle: "medium", timeStyle: "short" }) : "—");
export const fmtDay = (d) => (d ? new Date(`${String(d).slice(0, 10)}T00:00:00Z`).toLocaleDateString("en-GB", { timeZone: "UTC", weekday: "short", day: "2-digit", month: "short", year: "numeric" }) : "—");
export const pct = (s) => (s == null ? "n/a" : `${Math.round(Number(s) * 100)}%`);
