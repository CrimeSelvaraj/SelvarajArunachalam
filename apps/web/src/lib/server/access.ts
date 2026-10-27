import { randomBytes, randomInt } from "node:crypto";
import {
  type Account,
  type DeviceKind,
  ensureAccount,
  findAccount,
  markAccountPaid,
  updateStore,
  viewStore,
} from "@/lib/server/store";

const CODE_WINDOW_MS = 10 * 60 * 1000;
const CODE_LIMIT = 5;
const codeAttempts = new Map<string, number[]>();

export type PublicSession = {
  email: string;
  paid: boolean;
  deviceId: string;
  kind: DeviceKind;
};

function sixDigits(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

function tooManyCodes(email: string): boolean {
  const now = Date.now();
  const recent = (codeAttempts.get(email) ?? []).filter((stamp) => now - stamp < CODE_WINDOW_MS);
  if (recent.length >= CODE_LIMIT) {
    codeAttempts.set(email, recent);
    return true;
  }
  recent.push(now);
  codeAttempts.set(email, recent);
  return false;
}

function issueSession(account: Account, deviceId: string, kind: DeviceKind): string {
  const token = randomBytes(32).toString("hex");
  account.session = { token, deviceId, kind, at: new Date().toISOString() };
  account.challenge = null;
  return token;
}

function toPublic(account: Account): PublicSession | null {
  if (!account.session) return null;
  return {
    email: account.email,
    paid: account.paid,
    deviceId: account.session.deviceId,
    kind: account.session.kind,
  };
}

export function readSession(token: string | null): Promise<PublicSession | null> {
  if (!token) return Promise.resolve(null);
  return viewStore((db) => {
    const account = db.accounts.find((item) => item.session?.token === token);
    return account ? toPublic(account) : null;
  });
}

export function sessionForDevice(token: string | null, deviceId: string | null): Promise<PublicSession | null> {
  if (!token || !deviceId) return Promise.resolve(null);
  return readSession(token).then((session) => {
    if (!session || session.deviceId !== deviceId) return null;
    return session;
  });
}

export async function login(input: {
  email: string;
  deviceId: string;
  kind: DeviceKind;
}): Promise<
  | { status: "signed-in"; token: string; paid: boolean }
  | { status: "code-required"; code: string; otherKind: DeviceKind }
  | { status: "rate-limited" }
> {
  return updateStore((db) => {
    const account = ensureAccount(db, input.email);
    const active = account.session;
    if (active && active.deviceId !== input.deviceId) {
      if (tooManyCodes(input.email)) return { status: "rate-limited" as const };
      const code = sixDigits();
      account.challenge = {
        code,
        deviceId: input.deviceId,
        kind: input.kind,
        expiresAt: new Date(Date.now() + CODE_WINDOW_MS).toISOString(),
        phone: account.phone,
        misses: 0,
      };
      return { status: "code-required" as const, code, otherKind: active.kind };
    }
    const token = issueSession(account, input.deviceId, input.kind);
    return { status: "signed-in" as const, token, paid: account.paid };
  });
}

export async function verifyCode(input: {
  email: string;
  deviceId: string;
  code: string;
}): Promise<
  | { status: "signed-in"; token: string; paid: boolean }
  | { status: "mismatch" | "expired" | "no-challenge" | "too-many-tries" }
> {
  return updateStore((db) => {
    const account = findAccount(db, input.email);
    const challenge = account?.challenge;
    if (!account || !challenge || challenge.deviceId !== input.deviceId) {
      return { status: "no-challenge" as const };
    }
    if (Date.parse(challenge.expiresAt) < Date.now()) {
      account.challenge = null;
      return { status: "expired" as const };
    }
    if (challenge.code !== input.code) {
      challenge.misses += 1;
      if (challenge.misses >= 5) {
        account.challenge = null;
        return { status: "too-many-tries" as const };
      }
      return { status: "mismatch" as const };
    }
    const token = issueSession(account, input.deviceId, challenge.kind);
    return { status: "signed-in" as const, token, paid: account.paid };
  });
}

export async function logout(token: string | null): Promise<void> {
  if (!token) return;
  await updateStore((db) => {
    const account = db.accounts.find((item) => item.session?.token === token);
    if (account) account.session = null;
  });
}

export async function codeForSms(email: string, deviceId: string, phone: string): Promise<string | null> {
  return updateStore((db) => {
    const account = findAccount(db, email);
    if (!account?.challenge || account.challenge.deviceId !== deviceId) return null;
    if (Date.parse(account.challenge.expiresAt) < Date.now()) return null;
    account.phone = phone;
    account.challenge.phone = phone;
    return account.challenge.code;
  });
}

export async function markSessionPaid(token: string, ref: string): Promise<boolean> {
  return updateStore((db) => {
    const account = db.accounts.find((item) => item.session?.token === token);
    if (!account) return false;
    markAccountPaid(account, ref);
    return true;
  });
}

export async function rememberOrder(email: string, orderId: string): Promise<void> {
  await updateStore((db) => {
    const account = ensureAccount(db, email);
    account.pendingOrderId = orderId;
  });
}

export async function markPaidFromPayPal(input: {
  email: string | null;
  orderId: string | null;
  ref: string;
}): Promise<"paid" | "unknown"> {
  return updateStore((db) => {
    const byEmail = input.email ? findAccount(db, input.email) : undefined;
    const byOrder = input.orderId
      ? db.accounts.find((account) => account.pendingOrderId === input.orderId || account.paymentRef === input.orderId)
      : undefined;
    const account = byEmail ?? byOrder;
    if (!account) {
      if (!input.email) return "unknown" as const;
      const created = ensureAccount(db, input.email);
      markAccountPaid(created, input.ref);
      return "paid" as const;
    }
    markAccountPaid(account, input.ref);
    return "paid" as const;
  });
}
