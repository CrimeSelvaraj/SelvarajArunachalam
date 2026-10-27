export class HttpError extends Error {
  status: number;
  reason?: string;

  constructor(message: string, status: number, reason?: string) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.reason = reason;
  }
}

export class AuthError extends HttpError {
  constructor(
    message: string,
    status: number,
    reason: "unauthorized" | "replaced" | "unpaid",
  ) {
    super(message, status, reason);
    this.name = "AuthError";
  }
}

export class ParseError extends HttpError {
  constructor(message: string) {
    super(message, 422);
    this.name = "ParseError";
  }
}
