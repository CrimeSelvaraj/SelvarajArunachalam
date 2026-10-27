import { randomBytes } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import type { BookMeta, Database, PublicBadge, PublicBook } from "./types";

const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "db.json");
const TEXT_DIR = path.join(DATA_DIR, "texts");

let tail: Promise<void> = Promise.resolve();

function emptyDb(): Database {
  return { users: [], codes: [], books: [], badges: [] };
}

async function load(): Promise<Database> {
  try {
    const raw = await readFile(DB_PATH, "utf8");
    const parsed = JSON.parse(raw) as Partial<Database>;
    return {
      users: parsed.users ?? [],
      codes: parsed.codes ?? [],
      books: parsed.books ?? [],
      badges: parsed.badges ?? [],
    };
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT") return emptyDb();
    throw error;
  }
}

async function save(db: Database): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
  const tmp = path.join(DATA_DIR, `db.${process.pid}.tmp`);
  await writeFile(tmp, JSON.stringify(db, null, 2));
  await rename(tmp, DB_PATH);
}

function enqueue<T>(fn: () => Promise<T>): Promise<T> {
  const run = tail.then(fn, fn);
  tail = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

export function readDb<T>(fn: (db: Database) => Promise<T> | T): Promise<T> {
  return enqueue(async () => fn(await load()));
}

export function updateDb<T>(fn: (db: Database) => Promise<T> | T): Promise<T> {
  return enqueue(async () => {
    const db = await load();
    const result = await fn(db);
    await save(db);
    return result;
  });
}

export function newId(): string {
  return randomBytes(16).toString("hex");
}

export function textPath(id: string): string {
  if (!/^[a-f0-9]{32}$/.test(id)) {
    throw new Error("Invalid book id.");
  }
  return path.join(TEXT_DIR, `${id}.txt`);
}

export async function writeBookText(id: string, text: string): Promise<void> {
  await mkdir(TEXT_DIR, { recursive: true });
  await writeFile(textPath(id), text, "utf8");
}

export async function readBookText(id: string): Promise<string> {
  return readFile(textPath(id), "utf8");
}

export async function removeBookText(id: string): Promise<void> {
  await rm(textPath(id), { force: true });
}

export function publicBook(book: BookMeta): PublicBook {
  return {
    id: book.id,
    title: book.title,
    filename: book.filename,
    format: book.format,
    wordCount: book.wordCount,
    progress: book.progress,
    createdAt: book.createdAt,
    finishedAt: book.finishedAt,
  };
}

export function publicBadge(badge: Database["badges"][number]): PublicBadge {
  return {
    id: badge.id,
    bookId: badge.bookId,
    bookTitle: badge.bookTitle,
    earnedAt: badge.earnedAt,
    name: badge.name,
  };
}
