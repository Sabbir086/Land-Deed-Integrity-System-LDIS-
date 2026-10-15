import { requireRole } from "@/lib/auth";
// Every verification page is open to any signed-in role with a valid profile.
export const requireVerifier = () => requireRole(["user", "sub_registrar", "admin"]);
