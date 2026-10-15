// Server-side input validation for the API routes. Throws Error(message) on bad input.
const UUID = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
const DIGITS = "0-9০-৯";

export function str(v, name, { max = 120, re = null, optional = false } = {}) {
  if (v == null || String(v).trim() === "") {
    if (optional) return null;
    throw new Error(`${name} is required`);
  }
  const s = String(v).trim();
  if (s.length > max) throw new Error(`${name} is too long`);
  if (re && !re.test(s)) throw new Error(`${name} has an invalid format`);
  return s;
}
export const uuid = (v, name, opts = {}) => {
  const s = str(v, name, { max: 36, optional: opts.optional });
  if (s !== null && !UUID.test(s)) throw new Error(`${name} must be an id`);
  return s;
};
export const nid = (v) => str(v, "NID number", { max: 20, re: new RegExp(`^[${DIGITS}]{10,17}$`) });
export const dob = (v) => {
  const s = str(v, "Date of birth", { max: 10, re: /^\d{4}-\d{2}-\d{2}$/ });
  if (Number.isNaN(Date.parse(s))) throw new Error("Date of birth is invalid");
  return s;
};
export const date = (v, name = "Date") => {
  const s = str(v, name, { max: 10, re: /^\d{4}-\d{2}-\d{2}$/ });
  if (Number.isNaN(Date.parse(s))) throw new Error(`${name} is invalid`);
  return s;
};
export const digits = (v, name, max = 12) => str(v, name, { max, re: new RegExp(`^[${DIGITS}]{1,${max}}$`) });
export const positiveNumber = (v, name) => {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0 || n > 1e12) throw new Error(`${name} must be a positive number`);
  return n;
};
export const optionalPositive = (v) => (v == null || v === "" ? null : positiveNumber(v, "Value"));
