import { markPaidFromPayPal } from "@/lib/server/access";
import { json } from "@/lib/server/http";
import { paidFromWebhook, paypalConfigured, verifyWebhook } from "@/lib/server/paypal";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!paypalConfigured() || !process.env.PAYPAL_WEBHOOK_ID) {
    return json(
      {
        error: "webhook-verification-not-configured",
        message: "Set PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET, and PAYPAL_WEBHOOK_ID before this endpoint will mark an account paid.",
      },
      503,
    );
  }

  let event: unknown;
  try {
    event = await request.json();
  } catch {
    return json({ error: "Invalid webhook body." }, 400);
  }

  const verified = await verifyWebhook(request, event);
  if (!verified) return json({ error: "Webhook signature was not accepted." }, 401);

  const paid = paidFromWebhook(event as Parameters<typeof paidFromWebhook>[0]);
  if (!paid) return json({ status: "ignored" });
  const result = await markPaidFromPayPal({ email: paid.email, orderId: paid.orderId, ref: paid.ref });
  return json({ status: result });
}
