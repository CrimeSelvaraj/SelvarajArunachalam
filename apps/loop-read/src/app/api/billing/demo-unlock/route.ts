import { demoUnlock } from "@/lib/billing";
import { assertSameOrigin, errorResponse, json } from "@/lib/http";

export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    return json(await demoUnlock());
  } catch (error) {
    return errorResponse(error);
  }
}
