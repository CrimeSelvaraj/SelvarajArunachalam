import { rememberOrder } from "@/lib/server/access";
import { requireSession } from "@/lib/server/guard";
import { json } from "@/lib/server/http";
import { createAccessOrder, paypalConfigured } from "@/lib/server/paypal";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const gate = await requireSession(request);
  if (gate instanceof Response) return gate;
  if (gate.session.paid) return json({ error: "This email already has access." }, 409);
  if (!paypalConfigured()) return json({ error: "PayPal is not configured." }, 409);
  try {
    const id = await createAccessOrder(gate.session.email);
    await rememberOrder(gate.session.email, id);
    return json({ id });
  } catch (error) {
    console.error("[atoz] PayPal order failed", error instanceof Error ? error.message : "unknown");
    return json({ error: "PayPal could not start the $1 checkout." }, 502);
  }
}
