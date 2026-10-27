import { HttpError } from "./errors";

type PaypalConfig = {
  clientId: string;
  secret: string;
  base: string;
  mode: "sandbox" | "live";
};

type PaypalLink = { href?: string; rel?: string };
type PaypalAmount = { currency_code?: string; value?: string };
type PaypalCapture = { status?: string; amount?: PaypalAmount };
type PaypalOrder = {
  id?: string;
  status?: string;
  links?: PaypalLink[];
  purchase_units?: Array<{
    custom_id?: string;
    payments?: { captures?: PaypalCapture[] };
  }>;
};

export function paypalConfig(): PaypalConfig | null {
  const clientId = process.env.PAYPAL_CLIENT_ID?.trim();
  const secret = process.env.PAYPAL_CLIENT_SECRET?.trim();
  if (!clientId || !secret) return null;
  const mode = process.env.PAYPAL_MODE?.toLowerCase() === "live" ? "live" : "sandbox";
  const base = mode === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";
  return { clientId, secret, base, mode };
}

async function accessToken(cfg: PaypalConfig): Promise<string> {
  const basic = Buffer.from(`${cfg.clientId}:${cfg.secret}`).toString("base64");
  const res = await fetch(`${cfg.base}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) {
    console.error("[LOOP READ] PayPal token request failed", res.status);
    throw new HttpError("PayPal could not be reached. Try again shortly.", 502);
  }
  const data = (await res.json()) as { access_token?: string };
  if (!data.access_token) {
    throw new HttpError("PayPal could not be reached. Try again shortly.", 502);
  }
  return data.access_token;
}

function approveUrl(order: PaypalOrder): string | null {
  const links = order.links ?? [];
  return links.find((link) => link.rel === "payer-action")?.href
    ?? links.find((link) => link.rel === "approve")?.href
    ?? null;
}

export async function createPaypalOrder(input: {
  userId: string;
  returnUrl: string;
  cancelUrl: string;
}): Promise<{ id: string; approveUrl: string }> {
  const cfg = paypalConfig();
  if (!cfg) throw new HttpError("PayPal is not configured.", 400);
  const token = await accessToken(cfg);
  const res = await fetch(`${cfg.base}/v2/checkout/orders`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      intent: "CAPTURE",
      purchase_units: [
        {
          custom_id: input.userId,
          description: "LOOP READ access",
          amount: { currency_code: "USD", value: "1.00" },
        },
      ],
      payment_source: {
        paypal: {
          experience_context: {
            brand_name: "LOOP READ",
            shipping_preference: "NO_SHIPPING",
            user_action: "PAY_NOW",
            return_url: input.returnUrl,
            cancel_url: input.cancelUrl,
          },
        },
      },
    }),
  });
  const order = (await res.json()) as PaypalOrder;
  const url = approveUrl(order);
  if (!res.ok || !order.id || !url) {
    console.error("[LOOP READ] PayPal create order failed", res.status, order);
    throw new HttpError("PayPal could not start checkout.", 502);
  }
  return { id: order.id, approveUrl: url };
}

function isOneUsd(amount: PaypalAmount | undefined): boolean {
  if (amount?.currency_code !== "USD") return false;
  const value = Number(amount.value);
  return Number.isFinite(value) && Math.abs(value - 1) < 0.001;
}

export async function capturePaypalOrder(orderId: string, userId: string): Promise<void> {
  const cfg = paypalConfig();
  if (!cfg) throw new HttpError("PayPal is not configured.", 400);
  if (!/^[A-Z0-9]+$/i.test(orderId)) {
    throw new HttpError("That PayPal order id is not valid.", 400);
  }
  const token = await accessToken(cfg);
  const res = await fetch(`${cfg.base}/v2/checkout/orders/${orderId}/capture`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });
  const order = (await res.json()) as PaypalOrder;
  if (!res.ok) {
    console.error("[LOOP READ] PayPal capture failed", res.status, order);
    throw new HttpError("PayPal could not confirm the payment.", 502);
  }
  const unit = order.purchase_units?.[0];
  const capture = unit?.payments?.captures?.[0];
  if (order.status !== "COMPLETED" || capture?.status !== "COMPLETED" || !isOneUsd(capture?.amount)) {
    throw new HttpError("PayPal did not confirm a 1 USD payment.", 402);
  }
  if (unit?.custom_id && unit.custom_id !== userId) {
    throw new HttpError("This PayPal checkout belongs to a different account.", 403);
  }
}
