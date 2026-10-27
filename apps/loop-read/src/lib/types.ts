export type PaymentMethod = "paypal" | "demo";

export type User = {
  id: string;
  email: string;
  createdAt: string;
  paid: boolean;
  paidAt: string | null;
  paymentMethod: PaymentMethod | null;
  paypalOrderId: string | null;
  pendingPaypalOrderId: string | null;
  activeSessionId: string | null;
  previousSessionId: string | null;
  sessionExpiresAt: string | null;
};

export type LoginCode = {
  email: string;
  salt: string;
  codeHash: string;
  expiresAt: string;
  attempts: number;
};

export type BookFormat = "txt" | "epub" | "pdf";

export type BookMeta = {
  id: string;
  userId: string;
  title: string;
  filename: string;
  format: BookFormat;
  wordCount: number;
  progress: number;
  createdAt: string;
  finishedAt: string | null;
};

export type Badge = {
  id: string;
  userId: string;
  bookId: string;
  bookTitle: string;
  earnedAt: string;
  name: string;
};

export type Database = {
  users: User[];
  codes: LoginCode[];
  books: BookMeta[];
  badges: Badge[];
};

export type PublicViewer =
  | { kind: "anon" }
  | { kind: "replaced" }
  | { kind: "user"; email: string; paid: boolean };

export type PublicBook = {
  id: string;
  title: string;
  filename: string;
  format: BookFormat;
  wordCount: number;
  progress: number;
  createdAt: string;
  finishedAt: string | null;
};

export type PublicBadge = {
  id: string;
  bookId: string;
  bookTitle: string;
  earnedAt: string;
  name: string;
};
