import { HttpError } from "./errors";
import { requireUser } from "./auth";
import { capturePaypalOrder, createPaypalOrder, paypalConfig } from "./paypal";
import { updateDb } from "./store";

export function paypalEnabled(): boolean {
  return paypalConfig() !== null;
}

export async function demoUnlock(): Promise<{ paid: true; paymentMethod: "demo" }> {
  if (paypalEnabled()) {
    throw new HttpError("PayPal is configured. Pay the 1 USD access fee to continue.", 403);
  }
  const user = await requireUser();
  await updateDb((db) => {
    const row = db.users.find((item) => item.id === user.id);
    if (!row) throw new HttpError("Account not found.", 404);
    if (row.paid) return;
    row.paid = true;
    row.paidAt = new Date().toISOString();
    row.paymentMethod = "demo";
    row.paypalOrderId = null;
  });
  return { paid: true, paymentMethod: "demo" };
}

export async function beginPaypalCheckout(origin: string): Promise<{ approveUrl: string }> {
  if (!paypalEnabled()) {
    throw new HttpError("PayPal is not configured. Use the demo unlock on this server.", 400);
  }
  const user = await requireUser();
  if (user.paid) {
    throw new HttpError("Access is already unlocked.", 409);
  }
  const order = await createPaypalOrder({
    userId: user.id,
    returnUrl: `${origin}/access/paypal/return`,
    cancelUrl: `${origin}/access?paypal=cancel`,
  });
  await updateDb((db) => {
    const row = db.users.find((item) => item.id === user.id);
    if (!row) throw new HttpError("Account not found.", 404);
    row.pendingPaypalOrderId = order.id;
  });
  return { approveUrl: order.approveUrl };
}

export async function completePaypalCheckout(orderId: string): Promise<void> {
  const user = await requireUser();
  if (user.paid && user.paypalOrderId === orderId) return;
  if (user.pendingPaypalOrderId !== orderId) {
    throw new HttpError("This PayPal checkout does not belong to the current session.", 400);
  }
  await capturePaypalOrder(orderId, user.id);
  await updateDb((db) => {
    const row = db.users.find((item) => item.id === user.id);
    if (!row) throw new HttpError("Account not found.", 404);
    if (row.pendingPaypalOrderId !== orderId && row.paypalOrderId !== orderId) {
      throw new HttpError("This PayPal checkout does not belong to the current session.", 400);
    }
    row.paid = true;
    row.paidAt = new Date().toISOString();
    row.paymentMethod = "paypal";
    row.paypalOrderId = orderId;
    row.pendingPaypalOrderId = null;
  });
}
