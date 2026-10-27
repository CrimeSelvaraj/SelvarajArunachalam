import { markSessionPaid } from "@/lib/server/access";
import { requireSession } from "@/lib/server/guard";
import { json, readJson } from "@/lib/server/http";
import { captureAccessOrder, paypalConfigured } from "@/lib/server/paypal";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const gate = await requireSession(request);
  if (gate instanceof Response) return gate;
  if (!paypalConfigured()) return json({ error: "PayPal is not configured." }, 409);
  const body = await readJson(request);
  const orderId = typeof body?.orderId === "string" ? body.orderId : "";
  if (!/^[A-Z0-9]+$/.test(orderId)) return json({ error: "Missing PayPal order." }, 400);
  try {
    const captured = await captureAccessOrder(orderId, gate.session.email);
    if (!captured) return json({ error: "PayPal did not confirm a $1.00 USD payment." }, 402);
    const paid = await markSessionPaid(gate.token, captured.captureId);
    if (!paid) return json({ error: "signed-out", reason: "ended" }, 401);
    return json({ status: "paid" });
  } catch (error) {
    console.error("[atoz] PayPal capture failed", error instanceof Error ? error.message : "unknown");
    return json({ error: "PayPal could not confirm the payment." }, 502);
  }
}
