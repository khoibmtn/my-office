/** Error whose message is safe (and useful) to show to the end user. Other errors are masked. */
export class PublicError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PublicError'
  }
}

export function publicMessage(e: unknown, fallback: string): string {
  return e instanceof PublicError ? e.message : fallback
}
