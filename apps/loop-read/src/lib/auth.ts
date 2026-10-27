import { createHash, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { AuthError, HttpError } from "./errors";
import { deliverSignInCode, demoCodeVisible } from "./email";
import { newId, readDb, updateDb } from "./store";
import type { PublicViewer, User } from "./types";

export const SESSION_COOKIE = "loop_session";
const SESSION_MS = 1000 * 60 * 60 * 24 * 14;
const SESSION_SECONDS = 60 * 60 * 24 * 14;
const CODE_MS = 1000 * 60 * 10;

export function normalizeEmail(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const email = input.trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return email;
}

export function normalizeCode(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const code = input.trim();
  return /^\d{6}$/.test(code) ? code : null;
}

function hashCode(code: string, salt: string): string {
  return createHash("sha256").update(`${salt}:${code}`).digest("hex");
}

function codesMatch(code: string, salt: string, expectedHash: string): boolean {
  const actual = Buffer.from(hashCode(code, salt));
  const expected = Buffer.from(expectedHash);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function sessionLive(user: User, now = Date.now()): boolean {
  if (!user.activeSessionId || !user.sessionExpiresAt) return false;
  return Date.parse(user.sessionExpiresAt) > now;
}

function issueSession(user: User, now = Date.now()): string {
  const next = randomBytes(32).toString("hex");
  user.previousSessionId = user.activeSessionId;
  user.activeSessionId = next;
  user.sessionExpiresAt = new Date(now + SESSION_MS).toISOString();
  return next;
}

export async function getViewer(): Promise<
  | { kind: "anon" }
  | { kind: "replaced" }
  | { kind: "user"; user: User }
> {
  const jar = await cookies();
  const sid = jar.get(SESSION_COOKIE)?.value;
  if (!sid) return { kind: "anon" };
  return readDb((db) => {
    const now = Date.now();
    const active = db.users.find((user) => user.activeSessionId === sid && sessionLive(user, now));
    if (active) return { kind: "user" as const, user: active };
    const replaced = db.users.find((user) => user.previousSessionId === sid);
    if (replaced) return { kind: "replaced" as const };
    return { kind: "anon" as const };
  });
}

export function toPublicViewer(
  viewer: Awaited<ReturnType<typeof getViewer>>,
): PublicViewer {
  if (viewer.kind === "user") {
    return { kind: "user", email: viewer.user.email, paid: viewer.user.paid };
  }
  return viewer;
}

export async function requireUser(): Promise<User> {
  const viewer = await getViewer();
  if (viewer.kind === "user") return viewer.user;
  if (viewer.kind === "replaced") {
    throw new AuthError("This email signed in on another device.", 401, "replaced");
  }
  throw new AuthError("Sign in required.", 401, "unauthorized");
}

export async function requirePaidUser(): Promise<User> {
  const user = await requireUser();
  if (!user.paid) {
    throw new AuthError("Unlock access before using the library.", 403, "unpaid");
  }
  return user;
}

export async function setSessionCookie(sessionId: string): Promise<void> {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, sessionId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.LOOP_READ_COOKIE_SECURE === "1",
    path: "/",
    maxAge: SESSION_SECONDS,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}

export async function startSignIn(email: string): Promise<
  | { status: "signed_in"; paid: boolean }
  | { status: "code_required"; demo: boolean; devCode?: string }
> {
  const immediate = await updateDb((db) => {
    let user = db.users.find((row) => row.email === email);
    if (user && sessionLive(user)) {
      return { kind: "code" as const };
    }
    if (!user) {
      user = {
        id: newId(),
        email,
        createdAt: new Date().toISOString(),
        paid: false,
        paidAt: null,
        paymentMethod: null,
        paypalOrderId: null,
        pendingPaypalOrderId: null,
        activeSessionId: null,
        previousSessionId: null,
        sessionExpiresAt: null,
      };
      db.users.push(user);
    }
    db.codes = db.codes.filter((row) => row.email !== email);
    return { kind: "session" as const, sessionId: issueSession(user), paid: user.paid };
  });

  if (immediate.kind === "session") {
    await setSessionCookie(immediate.sessionId);
    return { status: "signed_in", paid: immediate.paid };
  }

  const code = randomInt(0, 1_000_000).toString().padStart(6, "0");
  let demo = true;
  try {
    const delivery = await deliverSignInCode(email, code);
    demo = delivery.demo;
  } catch (error) {
    console.error("[LOOP READ] sign-in email failed", error);
    throw new HttpError("The sign-in code could not be emailed. Check the mail settings and try again.", 502);
  }

  const salt = randomBytes(16).toString("hex");
  await updateDb((db) => {
    const user = db.users.find((row) => row.email === email);
    if (!user || !sessionLive(user)) return;
    db.codes = db.codes.filter((row) => row.email !== email);
    db.codes.push({
      email,
      salt,
      codeHash: hashCode(code, salt),
      expiresAt: new Date(Date.now() + CODE_MS).toISOString(),
      attempts: 0,
    });
  });

  return {
    status: "code_required",
    demo,
    ...(demo && demoCodeVisible() ? { devCode: code } : {}),
  };
}

export async function verifySignIn(email: string, code: string): Promise<{ paid: boolean }> {
  const result = await updateDb((db) => {
    const user = db.users.find((row) => row.email === email);
    const pending = db.codes.find((row) => row.email === email);
    if (!user || !pending) {
      return { ok: false as const, error: "Request a new code.", status: 400 };
    }
    if (Date.parse(pending.expiresAt) < Date.now()) {
      db.codes = db.codes.filter((row) => row.email !== email);
      return { ok: false as const, error: "That code expired. Request a new one.", status: 400 };
    }
    if (pending.attempts >= 5) {
      db.codes = db.codes.filter((row) => row.email !== email);
      return { ok: false as const, error: "Too many attempts. Request a new code.", status: 400 };
    }
    if (!codesMatch(code, pending.salt, pending.codeHash)) {
      pending.attempts += 1;
      return { ok: false as const, error: "That code is not right.", status: 400 };
    }
    db.codes = db.codes.filter((row) => row.email !== email);
    return { ok: true as const, sessionId: issueSession(user), paid: user.paid };
  });
  if (!result.ok) {
    throw new HttpError(result.error, result.status);
  }
  await setSessionCookie(result.sessionId);
  return { paid: result.paid };
}

export async function signOut(): Promise<void> {
  const jar = await cookies();
  const sid = jar.get(SESSION_COOKIE)?.value;
  if (sid) {
    await updateDb((db) => {
      const user = db.users.find((row) => row.activeSessionId === sid);
      if (!user) return;
      user.activeSessionId = null;
      user.previousSessionId = null;
      user.sessionExpiresAt = null;
    });
  }
  await clearSessionCookie();
}
