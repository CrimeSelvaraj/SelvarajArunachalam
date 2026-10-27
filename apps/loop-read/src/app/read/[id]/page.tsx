import { notFound } from "next/navigation";
import { SpeedReader } from "@/components/SpeedReader";
import { gatePaid } from "@/lib/gate";
import { loadReadableBook } from "@/lib/library";

export const metadata = { title: "Reader" };

export default async function ReadBookPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await gatePaid();
  const { id } = await params;
  const book = await loadReadableBook(user, id).catch(() => null);
  if (!book) notFound();

  return (
    <SpeedReader
      kicker={book.format.toUpperCase()}
      title={book.title}
      words={book.words}
      initialIndex={book.progress}
      bookId={book.id}
      alreadyFinished={Boolean(book.finishedAt)}
    />
  );
}
