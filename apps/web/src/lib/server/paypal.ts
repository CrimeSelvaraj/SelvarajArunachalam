const SANDBOX = "https://api-m.sandbox.paypal.com";
const LIVE = "https://api-m.paypal.com";

type TokenCache = { value: string; expiresAt: number };

let tokenCache: TokenCache | null = null;

export function paypalConfigured(): boolean {
  return Boolean(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET);
}

export function paypalClientId(): string | null {
  if (!paypalConfigured()) return null;
  return process.env.PAYPAL_CLIENT_ID ?? null;
}

function paypalBase(): string {
  return process.env.PAYPAL_ENV === "live" ? LIVE : SANDBOX;
}

async function accessToken(): Promise<string> {
  if (tokenCache && tokenCache.expiresAt > Date.now() + 30_000) return tokenCache.value;
  const id = process.env.PAYPAL_CLIENT_ID ?? "";
  const secret = process.env.PAYPAL_CLIENT_SECRET ?? "";
  const response = await fetch(`${paypalBase()}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ grant_type: "client_credentials" }),
  });
  if (!response.ok) throw new Error(`PayPal token request failed (${response.status})`);
  const payload = (await response.json()) as { access_token?: string; expires_in?: number };
  if (!payload.access_token || !payload.expires_in) throw new Error("PayPal token response was incomplete");
  tokenCache = { value: payload.access_token, expiresAt: Date.now() + payload.expires_in * 1000 };
  return payload.access_token;
}

async function paypalFetch(path: string, init: RequestInit): Promise<Response> {
  const token = await accessToken();
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  headers.set("Content-Type", "application/json");
  return fetch(`${paypalBase()}${path}`, { ...init, headers });
}

export async function createAccessOrder(email: string): Promise<string> {
  const response = await paypalFetch("/v2/checkout/orders", {
    method: "POST",
    body: JSON.stringify({
      intent: "CAPTURE",
      purchase_units: [
        {
          amount: { currency_code: "USD", value: "1.00" },
          description: "ATOZ access",
          custom_id: email,
        },
      ],
      application_context: {
        shipping_preference: "NO_SHIPPING",
        user_action: "PAY_NOW",
      },
    }),
  });
  if (!response.ok) throw new Error(`PayPal order request failed (${response.status})`);
  const payload = (await response.json()) as { id?: string };
  if (!payload.id) throw new Error("PayPal order response was incomplete");
  return payload.id;
}

type CaptureBody = {
  status?: string;
  purchase_units?: Array<{
    custom_id?: string;
    payments?: {
      captures?: Array<{
        id?: string;
        status?: string;
        amount?: { currency_code?: string; value?: string };
      }>;
    };
  }>;
};

export function isOneDollar(value: string | undefined, currency: string | undefined): boolean {
  if (currency !== "USD" || !value) return false;
  const amount = Number(value);
  return Number.isFinite(amount) && Math.abs(amount - 1) < 0.001;
}

export async function captureAccessOrder(orderId: string, email: string): Promise<{ captureId: string } | null> {
  const response = await paypalFetch(`/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`, {
    method: "POST",
    body: "{}",
  });
  if (!response.ok) throw new Error(`PayPal capture failed (${response.status})`);
  const payload = (await response.json()) as CaptureBody;
  const unit = payload.purchase_units?.[0];
  const capture = unit?.payments?.captures?.[0];
  if (payload.status !== "COMPLETED" || capture?.status !== "COMPLETED") return null;
  if (unit?.custom_id && unit.custom_id !== email) return null;
  if (!isOneDollar(capture?.amount?.value, capture?.amount?.currency_code)) return null;
  if (!capture?.id) return null;
  return { captureId: capture.id };
}

type WebhookEvent = {
  event_type?: string;
  resource?: {
    id?: string;
    custom_id?: string;
    status?: string;
    amount?: { currency_code?: string; value?: string };
    supplementary_data?: { related_ids?: { order_id?: string } };
  };
};

function paypalHost(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && (url.hostname === "paypal.com" || url.hostname.endsWith(".paypal.com"));
  } catch {
    return false;
  }
}

export async function verifyWebhook(request: Request, event: unknown): Promise<boolean> {
  const webhookId = process.env.PAYPAL_WEBHOOK_ID;
  if (!paypalConfigured() || !webhookId) return false;
  const transmissionId = request.headers.get("paypal-transmission-id");
  const transmissionTime = request.headers.get("paypal-transmission-time");
  const certUrl = request.headers.get("paypal-cert-url");
  const authAlgo = request.headers.get("paypal-auth-algo");
  const transmissionSig = request.headers.get("paypal-transmission-sig");
  if (!transmissionId || !transmissionTime || !certUrl || !authAlgo || !transmissionSig) return false;
  if (!paypalHost(certUrl)) return false;

  const response = await paypalFetch("/v1/notifications/verify-webhook-signature", {
    method: "POST",
    body: JSON.stringify({
      transmission_id: transmissionId,
      transmission_time: transmissionTime,
      cert_url: certUrl,
      auth_algo: authAlgo,
      transmission_sig: transmissionSig,
      webhook_id: webhookId,
      webhook_event: event,
    }),
  });
  if (!response.ok) return false;
  const payload = (await response.json()) as { verification_status?: string };
  return payload.verification_status === "SUCCESS";
}

export function paidFromWebhook(event: WebhookEvent): { email: string | null; orderId: string | null; ref: string } | null {
  if (event.event_type !== "PAYMENT.CAPTURE.COMPLETED") return null;
  const resource = event.resource;
  if (!resource || resource.status !== "COMPLETED") return null;
  if (!isOneDollar(resource.amount?.value, resource.amount?.currency_code)) return null;
  const email = resource.custom_id?.trim().toLowerCase() || null;
  const orderId = resource.supplementary_data?.related_ids?.order_id ?? null;
  if (!resource.id) return null;
  return { email, orderId, ref: resource.id };
}
