import { AuthError, HttpError } from "./errors";
import { extractDocument } from "./parse";
import { newId, publicBadge, publicBook, readBookText, readDb, removeBookText, updateDb, writeBookText } from "./store";
import type { BookMeta, Database, PublicBadge, PublicBook, User } from "./types";
import { splitWords } from "./words";

function ownedBook(db: Database, user: User, bookId: string): BookMeta {
  const book = db.books.find((row) => row.id === bookId);
  if (!book || book.userId !== user.id) {
    throw new HttpError("That book is not in your library.", 404);
  }
  return book;
}

export async function listBooks(user: User): Promise<PublicBook[]> {
  return readDb((db) =>
    db.books
      .filter((book) => book.userId === user.id)
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
      .map(publicBook),
  );
}

export async function addBook(user: User, filename: string, buffer: Buffer): Promise<PublicBook> {
  if (!user.paid) {
    throw new AuthError("Unlock access before using the library.", 403, "unpaid");
  }
  const extracted = await extractDocument(filename, buffer);
  const id = newId();
  const book = {
    id,
    userId: user.id,
    title: extracted.title,
    filename: filename.replace(/^.*[/\\]/, "").slice(0, 180) || "upload",
    format: extracted.format,
    wordCount: extracted.wordCount,
    progress: 0,
    createdAt: new Date().toISOString(),
    finishedAt: null,
  };
  await writeBookText(id, extracted.text);
  try {
    await updateDb((db) => {
      db.books.push(book);
    });
  } catch (error) {
    await removeBookText(id);
    throw error;
  }
  return publicBook(book);
}

export async function removeBook(user: User, bookId: string): Promise<void> {
  await updateDb((db) => {
    const book = db.books.find((row) => row.id === bookId);
    if (!book || book.userId !== user.id) {
      throw new HttpError("That book is not in your library.", 404);
    }
    db.books = db.books.filter((row) => row.id !== bookId);
  });
  await removeBookText(bookId);
}

export async function loadReadableBook(user: User, bookId: string) {
  const meta = await readDb((db) => {
    const book = db.books.find((row) => row.id === bookId && row.userId === user.id);
    return book ? publicBook(book) : null;
  });
  if (!meta) return null;
  const text = await readBookText(meta.id);
  return { ...meta, words: splitWords(text) };
}

export async function saveProgress(user: User, bookId: string, index: number): Promise<number> {
  if (!Number.isInteger(index) || index < 0) {
    throw new HttpError("Progress is out of range.", 400);
  }
  return updateDb((db) => {
    const book = ownedBook(db, user, bookId);
    if (index > book.wordCount) {
      throw new HttpError("Progress is out of range.", 400);
    }
    book.progress = index;
    return book.progress;
  });
}

export async function finishBook(user: User, bookId: string): Promise<{ badge: PublicBadge; newlyAwarded: boolean }> {
  const awarded = await updateDb((db) => {
    const book = ownedBook(db, user, bookId);
    book.progress = book.wordCount;
    const existing = db.badges.find((badge) => badge.userId === user.id && badge.bookId === book.id);
    if (existing) {
      if (!book.finishedAt) book.finishedAt = existing.earnedAt;
      return { badge: publicBadge(existing), newlyAwarded: false };
    }
    const earnedAt = new Date().toISOString();
    book.finishedAt = earnedAt;
    const badge = {
      id: newId(),
      userId: user.id,
      bookId: book.id,
      bookTitle: book.title,
      earnedAt,
      name: "Loop closed",
    };
    db.badges.push(badge);
    return { badge: publicBadge(badge), newlyAwarded: true };
  });
  return awarded;
}

export async function listBadges(user: User): Promise<PublicBadge[]> {
  return readDb((db) =>
    db.badges
      .filter((badge) => badge.userId === user.id)
      .sort((a, b) => (a.earnedAt < b.earnedAt ? 1 : -1))
      .map(publicBadge),
  );
}
