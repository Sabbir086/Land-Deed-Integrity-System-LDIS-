import { requireRole } from "@/lib/auth";

// Direct lookup workspaces are reserved for staff. User-side checks belong
// inside the deed-registration workflow, not standalone verification pages.
export const requireVerifier = () => requireRole(["sub_registrar", "admin"]);
