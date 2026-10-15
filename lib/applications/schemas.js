// Server-side input parsers for /api/applications/[action]. Each returns the RPC argument object or throws Error(message).
// These are the FIRST line of validation; the RPCs validate again. Numbers may be typed in Bangla digits.
import { str, uuid, nid, dob, date } from "../verify/schemas.js";
import { bn2en } from "../utils.js";

const ROLE = /^(donor|donee)$/;
const ROUTE = /^(record_owner|warish|baya_deed)$/;
const FEE = /^(stamp|registration|source_tax|other)$/;
const DOC = /^(nid_copy|porcha_copy|warish_certificate|previous_deed|attestation|other)$/;

export function areaValue(v, name = "Area") {
  if (v == null || String(v).trim() === "") return null;
  const s = bn2en(v);
  if (!/^\d{1,7}(\.\d{1,4})?$/.test(s)) throw new Error(`${name} must be a number with up to 4 decimals`);
  const n = Number(s);
  if (!(n > 0)) throw new Error(`${name} must be greater than 0`);
  return n;
}
export function moneyValue(v, name = "Amount") {
  const s = bn2en(String(v ?? "").replace(/,/g, ""));
  if (!/^\d{1,12}(\.\d{1,2})?$/.test(s)) throw new Error(`${name} must be a number with up to 2 decimals`);
  const n = Number(s);
  if (!(n > 0)) throw new Error(`${name} must be greater than 0`);
  return n;
}
const appId = (b) => uuid(b.app_id, "application");
const list = (v, name, max) => { if (!Array.isArray(v) || v.length < 1 || v.length > max) throw new Error(`${name} must have 1 to ${max} items`); return v; };

export const ACTIONS = {
  create: { rpc: "app_create_draft", parse: () => ({}) },
  get: { rpc: "app_get", parse: (b) => ({ p_app: appId(b) }) },
  progress: { rpc: "app_save_progress", parse: (b) => { const n = Number(b.step); if (!Number.isInteger(n) || n < 1 || n > 9) throw new Error("step is invalid"); return { p_app: appId(b), p_step: n }; } },
  party: { rpc: "app_set_party", parse: (b) => ({ p_app: appId(b), p_role: str(b.role, "role", { re: ROLE }), p_nid: nid(b.nid_no), p_dob: dob(b.dob) }) },
  land: { rpc: "app_set_land", parse: (b) => ({ p_app: appId(b), p_location_id: uuid(b.location_id, "mouza"), p_khatian_type: str(b.khatian_type, "khatian type", { max: 60 }), p_khatian_no: str(b.khatian_no, "khatian number", { max: 12, re: /^[0-9০-৯]{1,12}$/ }) }) },
  ownership: { rpc: "app_set_ownership", parse: (b) => {
    const route = str(b.route, "route", { re: ROUTE });
    return {
      p_app: appId(b), p_route: route,
      p_owner_id: route === "baya_deed" ? null : uuid(b.owner_id, "owner"),
      p_cert_no: route === "warish" ? str(b.cert_no, "certificate number", { max: 60 }) : null,
      p_deed_no: route === "baya_deed" ? str(b.deed_no, "deed number", { max: 14, re: /^[0-9০-৯]{1,6}(\/[0-9০-৯]{4})?$/ }) : null,
      p_deed_date: route === "baya_deed" ? date(b.deed_date, "Deed date") : null,
    };
  } },
  plots: { rpc: "app_set_plots", parse: (b) => ({ p_app: appId(b), p_plots: list(b.plots, "plots", 10).map((p) => ({ dag_id: uuid(p.dag_id, "dag"), area_sold: areaValue(p.area_sold, "Area") })) }) },
  details: { rpc: "app_set_details", parse: (b) => ({
    p_app: appId(b),
    p_details: b.details == null ? null : list(b.details, "details", 10).map((d) => ({ dag_id: uuid(d.dag_id, "dag"), land_class: str(d.land_class, "land class", { max: 40, optional: true }) })),
    p_price: b.price == null || b.price === "" ? null : moneyValue(b.price, "Price"),
  }) },
  challan: { rpc: "app_verify_challan", parse: (b) => ({ p_app: appId(b), p_type: str(b.challan_type, "fee type", { re: FEE }), p_challan_no: str(b.challan_no, "challan number", { max: 40, re: /^[A-Za-z0-9০-৯-]{3,40}$/ }), p_amount: moneyValue(b.amount, "Amount") }) },
  "challan-release": { rpc: "app_release_challan", parse: (b) => ({ p_app: appId(b), p_type: str(b.challan_type, "fee type", { re: FEE }) }) },
  "appointment-availability": { rpc: "app_appointment_availability", parse: (b) => ({ p_app: appId(b) }) },
  "appointment-book": { rpc: "app_book_appointment", parse: (b) => ({ p_app: appId(b), p_date: date(b.date, "Date"), p_slot: str(b.slot, "slot", { max: 5, re: /^\d{2}:\d{2}$/ }) }) },
  "appointment-cancel": { rpc: "app_cancel_appointment", parse: (b) => ({ p_app: appId(b) }) },
  "document-register": { rpc: "app_register_document", parse: (b) => ({ p_app: appId(b), p_type: str(b.doc_type, "document type", { re: DOC }), p_path: str(b.path, "path", { max: 400 }), p_name: str(b.file_name, "file name", { max: 200 }), p_mime: str(b.mime_type, "mime type", { max: 40 }), p_size: Math.trunc(Number(b.size_bytes)) }) },
  "document-delete": { rpc: "app_delete_document", parse: (b) => ({ p_app: appId(b), p_doc: uuid(b.doc_id, "document") }) },
  submit: { rpc: "app_submit", parse: (b) => ({ p_app: appId(b), p_accept: b.accept === true }) },
  withdraw: { rpc: "app_withdraw", parse: (b) => ({ p_app: appId(b) }) },
  "notifications-read": { rpc: "notifications_mark_read", parse: (b) => ({ p_ids: Array.isArray(b.ids) && b.ids.length ? b.ids.slice(0, 50).map((i) => uuid(i, "notification")) : null }) },
};
