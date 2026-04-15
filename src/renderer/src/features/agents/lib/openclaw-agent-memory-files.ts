export const MEMORY_FILE_NAMES = ['MEMORY.md', 'memory.md'] as const

const DAILY_MEMORY_FILE_RE = /^memory\/(?:.+\/)?(\d{4}-\d{2}-\d{2})(?:-([^/]+))?\.md$/i

function normalizeFileName(value: string): string {
  let normalized = value.trim().replace(/\\/g, '/')

  while (normalized.startsWith('./')) {
    normalized = normalized.slice(2)
  }

  normalized = normalized.replace(/^\/+/, '')
  normalized = normalized.replace(/\/{2,}/g, '/')
  return normalized
}

function extractDailyMemoryMeta(
  fileName: string
): {
  date: string
  suffix: string | null
} | null {
  const matched = DAILY_MEMORY_FILE_RE.exec(fileName)
  if (!matched) {
    return null
  }

  return {
    date: matched[1],
    suffix: matched[2] ?? null
  }
}

export function isMemoryFileName(fileName: string): boolean {
  const normalized = normalizeFileName(fileName)
  if (MEMORY_FILE_NAMES.includes(normalized as (typeof MEMORY_FILE_NAMES)[number])) {
    return true
  }
  return /^memory\/.+/i.test(normalized)
}

export function sortMemoryFileNames(values: string[]): string[] {
  const normalizedUnique = Array.from(
    new Set(values.map((entry) => normalizeFileName(entry)).filter((entry) => entry.length > 0))
  )

  return [...normalizedUnique].sort((left, right) => {
    const leftPriority = MEMORY_FILE_NAMES.indexOf(left as (typeof MEMORY_FILE_NAMES)[number])
    const rightPriority = MEMORY_FILE_NAMES.indexOf(right as (typeof MEMORY_FILE_NAMES)[number])
    const hasLeftPriority = leftPriority >= 0
    const hasRightPriority = rightPriority >= 0
    if (hasLeftPriority || hasRightPriority) {
      if (hasLeftPriority && hasRightPriority) {
        return leftPriority - rightPriority
      }
      return hasLeftPriority ? -1 : 1
    }

    const leftDaily = extractDailyMemoryMeta(left)
    const rightDaily = extractDailyMemoryMeta(right)
    if (leftDaily && rightDaily && leftDaily.date !== rightDaily.date) {
      return rightDaily.date.localeCompare(leftDaily.date)
    }
    if (leftDaily || rightDaily) {
      if (leftDaily && rightDaily) {
        return right.localeCompare(left)
      }
      return leftDaily ? -1 : 1
    }

    return left.localeCompare(right)
  })
}

function normalizeLabelSuffix(suffix: string): string {
  return suffix
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function toMemoryListLabel(fileName: string): string {
  const normalizedFileName = normalizeFileName(fileName)
  const daily = extractDailyMemoryMeta(normalizedFileName)
  if (daily) {
    if (daily.suffix) {
      const labelSuffix = normalizeLabelSuffix(daily.suffix)
      if (labelSuffix) {
        return `${daily.date} · ${labelSuffix}`
      }
    }
    return daily.date
  }

  if (normalizedFileName.startsWith('memory/')) {
    return normalizedFileName.slice('memory/'.length)
  }
  return normalizedFileName
}
