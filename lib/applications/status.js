// Application statuses and user-facing explanations. Mirrors public.application_status_rules (07 migration).
// Stage 2 user transitions are active; sub-registrar transitions are Stage 3 (inactive in the DB rules table).
export const STATUS = {
  draft: { bn: "খসড়া", en: "Draft", tone: "slate", editable: true,
    explainBn: "আবেদনটি এখনো জমা হয়নি। আপনি যেকোনো সময় সংরক্ষণ করে পরে চালিয়ে যেতে পারবেন।",
    explainEn: "Not submitted yet. Save and continue any time." },
  submitted: { bn: "জমা হয়েছে", en: "Submitted", tone: "blue", editable: false,
    explainBn: "আবেদন জমা হয়েছে এবং সাব-রেজিস্ট্রারের পর্যালোচনার অপেক্ষায় আছে। এই অবস্থায় সাধারণ সম্পাদনা বন্ধ।",
    explainEn: "Submitted and waiting for sub-registrar review. Normal editing is closed." },
  discrepancy_review: { bn: "অসংগতি যাচাইয়ে আটকানো", en: "Held for discrepancy review", tone: "amber", editable: false,
    explainBn: "যাচাইয়ে এক বা একাধিক উচ্চ-ঝুঁকির সূচক পাওয়া গেছে। এটি জালিয়াতির প্রমাণ নয়; কর্তৃপক্ষ পর্যালোচনা করবে।",
    explainEn: "One or more high-risk indicators were found. This is not proof of fraud; an official will review." },
  under_review: { bn: "পর্যালোচনাধীন", en: "Under review", tone: "purple", editable: false,
    explainBn: "সাব-রেজিস্ট্রার আবেদনটি পর্যালোচনা করছেন।", explainEn: "A sub-registrar is reviewing the application. (Set by Stage 3.)" },
  correction_requested: { bn: "সংশোধন প্রয়োজন", en: "Correction requested", tone: "red", editable: true,
    explainBn: "কর্তৃপক্ষ সংশোধনের অনুরোধ করেছেন। নিচের বার্তা দেখে তথ্য ঠিক করে আবার জমা দিন।",
    explainEn: "The office asked for corrections. Read the message, fix the data and resubmit." },
  registered: { bn: "নিবন্ধিত", en: "Registered", tone: "green", editable: false,
    explainBn: "দলিল নিবন্ধিত হয়েছে।", explainEn: "The deed has been registered. (Set by Stage 3.)" },
  rejected: { bn: "প্রত্যাখ্যাত", en: "Rejected", tone: "red", editable: false,
    explainBn: "আবেদন প্রত্যাখ্যান করা হয়েছে।", explainEn: "The application was rejected. (Set by Stage 3.)" },
  withdrawn: { bn: "প্রত্যাহার করা হয়েছে", en: "Withdrawn", tone: "slate", editable: false,
    explainBn: "আপনি আবেদনটি প্রত্যাহার করেছেন।", explainEn: "You withdrew this application." },
};

export const statusMeta = (s) => STATUS[s] || { bn: s, en: s, tone: "slate", editable: false, explainBn: "", explainEn: "" };
export const canEdit = (s) => !!STATUS[s]?.editable;
// Only the states that have an active user->withdrawn rule in public.application_status_rules.
export const canWithdraw = (s) => ["draft", "correction_requested", "submitted", "discrepancy_review"].includes(s);
export const canChangeAppointment = (s) => ["draft", "correction_requested", "submitted", "discrepancy_review"].includes(s);

export const FEE_TYPE_LABEL = {
  stamp: { bn: "স্ট্যাম্প ফি", en: "Stamp fee" }, registration: { bn: "রেজিস্ট্রেশন ফি", en: "Registration fee" },
  source_tax: { bn: "উৎসে কর", en: "Source tax" }, other: { bn: "অন্যান্য ফি", en: "Other fees" },
};

export const CHALLAN_REASON = {
  AMOUNT_NOT_DUE: "প্রদেয় পরিমাণের সঙ্গে আপনার দেওয়া পরিমাণ মেলেনি · The amount does not equal the amount due.",
  NOT_FOUND: "এই নম্বরে কোনো চালান পাওয়া যায়নি · No challan found with this number.",
  AMOUNT_MISMATCH: "চালানের রেকর্ডের পরিমাণের সঙ্গে মেলেনি · The amount does not match the challan record.",
  FEE_TYPE_MISMATCH: "ফি-এর ধরন মেলেনি · The fee type does not match the challan record.",
  RECORD_UNVERIFIED: "চালান রেকর্ড যাচাইকৃত নয় · The challan record is not verified.",
  ALREADY_USED: "চালানটি ইতিমধ্যে ব্যবহৃত · This challan is already used by another application.",
};

export const LAND_CLASSES = ["নাল", "বাড়ি", "ভিটা", "মাটিয়াল", "পুকুর"];
export const DOC_TYPES = {
  nid_copy: "NID কপি · NID copy", porcha_copy: "পর্চা কপি · Porcha copy", warish_certificate: "ওয়ারিশ সার্টিফিকেট · Warish certificate",
  previous_deed: "পূর্ববর্তী দলিল · Previous deed", attestation: "প্রত্যয়নপত্র · Attestation", other: "অন্যান্য · Other",
};
