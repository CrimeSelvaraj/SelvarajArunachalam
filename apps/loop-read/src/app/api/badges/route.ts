import { requirePaidUser } from "@/lib/auth";
import { errorResponse, json } from "@/lib/http";
import { listBadges } from "@/lib/library";

export async function GET() {
  try {
    const user = await requirePaidUser();
    return json({ badges: await listBadges(user) });
  } catch (error) {
    return errorResponse(error);
  }
}
