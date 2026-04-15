export function toOpenClawCronErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback
}
