import { HttpError } from "./errors";

export function json(data: unknown, status = 200): Response {
  return Response.json(data, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export function errorResponse(error: unknown): Response {
  if (error instanceof HttpError) {
    return json({ error: error.message, reason: error.reason ?? null }, error.status);
  }
  console.error("[LOOP READ]", error);
  return json({ error: "Something went wrong.", reason: null }, 500);
}

export function assertSameOrigin(req: Request): void {
  const origin = req.headers.get("origin");
  if (!origin) return;
  let host = "";
  try {
    host = new URL(origin).host;
  } catch {
    throw new HttpError("Cross-origin request blocked.", 403);
  }
  const expected = (req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "").split(",")[0]?.trim();
  if (!expected || host !== expected) {
    throw new HttpError("Cross-origin request blocked.", 403);
  }
}

export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    throw new HttpError("Send a JSON body.", 400);
  }
}

export function requestOrigin(req: Request): string {
  const host = (req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "").split(",")[0]?.trim();
  const proto = (req.headers.get("x-forwarded-proto") ?? "http").split(",")[0]?.trim();
  if (!host) throw new HttpError("Missing host.", 400);
  return `${proto}://${host}`;
}
