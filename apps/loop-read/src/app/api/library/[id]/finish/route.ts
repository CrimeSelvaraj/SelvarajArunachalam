import { requirePaidUser } from "@/lib/auth";
import { assertSameOrigin, errorResponse, json } from "@/lib/http";
import { finishBook } from "@/lib/library";

type Context = { params: Promise<{ id: string }> };

export async function POST(req: Request, context: Context) {
  try {
    assertSameOrigin(req);
    const user = await requirePaidUser();
    const { id } = await context.params;
    return json(await finishBook(user, id));
  } catch (error) {
    return errorResponse(error);
  }
}
