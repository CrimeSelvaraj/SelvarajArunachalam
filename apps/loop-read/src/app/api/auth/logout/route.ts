import { signOut } from "@/lib/auth";
import { assertSameOrigin, errorResponse, json } from "@/lib/http";

export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    await signOut();
    return json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
