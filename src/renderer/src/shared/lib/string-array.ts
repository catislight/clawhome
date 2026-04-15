export function toUniqueTrimmedStrings(values: string[]): string[] {
  return Array.from(
    new Set(values.map((entry) => entry.trim()).filter((entry) => entry.length > 0))
  )
}
