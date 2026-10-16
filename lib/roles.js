export const ROLES = { USER: "user", SUB_REGISTRAR: "sub_registrar", ADMIN: "admin", DATA_ENTRY_OPERATOR: "data_entry_operator" };

export const ROLE_HOME = {
  user: "/dashboard",
  sub_registrar: "/sub-registrar",
  admin: "/admin",
  data_entry_operator: "/data-entry",
};

export const ROLE_LABEL = {
  user: { en: "User", bn: "ব্যবহারকারী" },
  sub_registrar: { en: "Sub-Registrar", bn: "সাব-রেজিস্ট্রার" },
  admin: { en: "Administrator", bn: "প্রশাসক" },
  data_entry_operator: { en: "Data Entry Operator", bn: "ডাটা এন্ট্রি অপারেটর" },
};

export const homeFor = (role) => ROLE_HOME[role] || "/dashboard";
