import { requirePaidUser, requireUser } from "@/lib/auth";
import { ParseError } from "@/lib/errors";
import { HttpError } from "@/lib/errors";
import { assertSameOrigin, errorResponse, json } from "@/lib/http";
import { addBook, listBooks } from "@/lib/library";

export const runtime = "nodejs";

export async function GET() {
  try {
    const user = await requireUser();
    if (!user.paid) {
      return json({ error: "Unlock access before using the library.", reason: "unpaid" }, 403);
    }
    return json({ books: await listBooks(user) });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    const user = await requirePaidUser();
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      throw new HttpError("Choose a file to upload.", 400);
    }
    const buffer = Buffer.from(await file.arrayBuffer());
    const book = await addBook(user, file.name || "upload.txt", buffer);
    return json({ book }, 201);
  } catch (error) {
    if (error instanceof ParseError) return errorResponse(error);
    return errorResponse(error);
  }
}
