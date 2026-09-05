export class QraftError extends Error {
  constructor(
    public readonly code: "validation" | "not-found" | "conflict" | "locked" | "io",
    message: string,
    public readonly retryable = false,
  ) {
    super(message);
    this.name = "QraftError";
  }
}

export function normalizeEntityText(value: string): string {
  const normalized = value.trim().replace(/\s+/gu, " ");
  if (normalized.length === 0) throw new QraftError("validation", "Enter some text before saving.");
  if ([...normalized].length > 2_000)
    throw new QraftError("validation", "Text must be 2,000 characters or fewer.");
  if (/\p{Cc}/u.test(normalized))
    throw new QraftError("validation", "Text contains unsupported control characters.");
  return normalized;
}
