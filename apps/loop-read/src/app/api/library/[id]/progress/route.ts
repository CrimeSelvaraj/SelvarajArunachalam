import { requirePaidUser } from "@/lib/auth";
import { HttpError } from "@/lib/errors";
import { assertSameOrigin, errorResponse, json, readJson } from "@/lib/http";
import { saveProgress } from "@/lib/library";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, context: Context) {
  try {
    assertSameOrigin(req);
    const user = await requirePaidUser();
    const { id } = await context.params;
    const body = (await readJson(req)) as { index?: unknown };
    if (typeof body.index !== "number") {
      throw new HttpError("Progress is out of range.", 400);
    }
    const progress = await saveProgress(user, id, body.index);
    return json({ progress });
  } catch (error) {
    return errorResponse(error);
  }
}
