import { startSignIn, normalizeEmail } from "@/lib/auth";
import { HttpError } from "@/lib/errors";
import { assertSameOrigin, errorResponse, json, readJson } from "@/lib/http";

export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    const body = (await readJson(req)) as { email?: unknown };
    const email = normalizeEmail(body.email);
    if (!email) throw new HttpError("Enter a valid email address.", 400);
    return json(await startSignIn(email));
  } catch (error) {
    return errorResponse(error);
  }
}
