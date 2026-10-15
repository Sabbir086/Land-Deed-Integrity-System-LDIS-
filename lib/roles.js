export const ROLES = { USER: "user", SUB_REGISTRAR: "sub_registrar", ADMIN: "admin" };

export const ROLE_HOME = {
  user: "/dashboard",
  sub_registrar: "/sub-registrar",
  admin: "/admin",
};

export const ROLE_LABEL = {
  user: { en: "User", bn: "ব্যবহারকারী" },
  sub_registrar: { en: "Sub-Registrar", bn: "সাব-রেজিস্ট্রার" },
  admin: { en: "Administrator", bn: "প্রশাসক" },
};

export const homeFor = (role) => ROLE_HOME[role] || "/dashboard";
