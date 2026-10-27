import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

export type DeviceKind = "desktop" | "phone";

export type SessionRecord = {
  token: string;
  deviceId: string;
  kind: DeviceKind;
  at: string;
};

export type ChallengeRecord = {
  code: string;
  deviceId: string;
  kind: DeviceKind;
  expiresAt: string;
  phone: string | null;
  misses: number;
};

export type Account = {
  email: string;
  paid: boolean;
  paidAt: string | null;
  paymentRef: string | null;
  pendingOrderId: string | null;
  phone: string | null;
  session: SessionRecord | null;
  challenge: ChallengeRecord | null;
};

export type OutboxEntry = {
  id: string;
  at: string;
  channel: "email" | "sms";
  to: string;
  body: string;
  delivered: boolean;
};

type Database = {
  accounts: Account[];
  outbox: OutboxEntry[];
};

const filePath = path.join(process.cwd(), "data", "access.json");

const empty = (): Database => ({ accounts: [], outbox: [] });

let queue: Promise<unknown> = Promise.resolve();

async function load(): Promise<Database> {
  try {
    const raw = await readFile(filePath, "utf8");
    const parsed = JSON.parse(raw) as Database;
    if (!parsed || !Array.isArray(parsed.accounts) || !Array.isArray(parsed.outbox)) return empty();
    return parsed;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return empty();
    throw error;
  }
}

async function save(db: Database): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  const temporary = `${filePath}.tmp`;
  await writeFile(temporary, JSON.stringify(db, null, 2));
  await rename(temporary, filePath);
}

export function updateStore<T>(fn: (db: Database) => Promise<T> | T): Promise<T> {
  const run = queue.then(async () => {
    const db = await load();
    const result = await fn(db);
    await save(db);
    return result;
  });
  queue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

export function viewStore<T>(fn: (db: Database) => T): Promise<T> {
  return queue.then(async () => fn(await load()));
}

export function blankAccount(email: string): Account {
  return {
    email,
    paid: false,
    paidAt: null,
    paymentRef: null,
    pendingOrderId: null,
    phone: null,
    session: null,
    challenge: null,
  };
}

export function findAccount(db: Database, email: string): Account | undefined {
  return db.accounts.find((account) => account.email === email);
}

export function ensureAccount(db: Database, email: string): Account {
  const existing = findAccount(db, email);
  if (existing) return existing;
  const created = blankAccount(email);
  db.accounts.push(created);
  return created;
}

export function appendOutbox(db: Database, entry: OutboxEntry): void {
  db.outbox.push(entry);
  if (db.outbox.length > 40) db.outbox.splice(0, db.outbox.length - 40);
}

export function markAccountPaid(account: Account, ref: string): void {
  account.paid = true;
  account.paidAt = new Date().toISOString();
  account.paymentRef = ref;
  account.pendingOrderId = null;
}
