import { runAppAction } from "@/lib/app-api";

export const dynamic = "force-dynamic";
export async function POST(request, { params }) {
  return runAppAction(request, params.action);
}
