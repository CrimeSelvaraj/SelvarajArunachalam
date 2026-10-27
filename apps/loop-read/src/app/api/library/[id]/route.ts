import { requirePaidUser } from "@/lib/auth";
import { assertSameOrigin, errorResponse, json } from "@/lib/http";
import { removeBook } from "@/lib/library";

type Context = { params: Promise<{ id: string }> };

export async function DELETE(req: Request, context: Context) {
  try {
    assertSameOrigin(req);
    const user = await requirePaidUser();
    const { id } = await context.params;
    await removeBook(user, id);
    return json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
