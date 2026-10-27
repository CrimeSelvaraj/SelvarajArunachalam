import { beginPaypalCheckout } from "@/lib/billing";
import { assertSameOrigin, errorResponse, json, requestOrigin } from "@/lib/http";

export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    return json(await beginPaypalCheckout(requestOrigin(req)));
  } catch (error) {
    return errorResponse(error);
  }
}
