import type {
  KnowledgeBaseFavoriteItem,
  KnowledgeBasePromptTemplate
} from '@/features/knowledge-base/store/use-knowledge-base-store'
import { getCurrentAppLanguage } from '@/shared/i18n/app-i18n'

export type KnowledgeBaseRecencyFilter = 'all' | '7d' | '30d'

const DAY_IN_MS = 24 * 60 * 60 * 1000

function normalizeKeyword(value: string): string {
  return value.trim().toLowerCase()
}

function buildSearchableText(parts: Array<string | null | undefined>): string {
  return parts
    .map((part) => part ?? '')
    .join(' ')
    .toLowerCase()
}

function shouldKeepItemByRecency(
  timestampValue: string,
  recencyFilter: KnowledgeBaseRecencyFilter,
  nowTimestamp: number
): boolean {
  if (recencyFilter === 'all') {
    return true
  }

  const timestamp = Date.parse(timestampValue)
  if (Number.isNaN(timestamp)) {
    return false
  }

  const thresholdDays = recencyFilter === '7d' ? 7 : 30
  return nowTimestamp - timestamp <= thresholdDays * DAY_IN_MS
}

export function formatKnowledgeBaseTimestamp(value: string): string {
  const timestamp = Date.parse(value)
  if (Number.isNaN(timestamp)) {
    return '--'
  }

  const language = getCurrentAppLanguage()
  const locale = language === 'en-US' ? 'en-US' : 'zh-CN'

  return new Intl.DateTimeFormat(locale, {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(new Date(timestamp))
}

export function filterKnowledgeBaseFavorites(
  favorites: KnowledgeBaseFavoriteItem[],
  keyword: string
): KnowledgeBaseFavoriteItem[] {
  const normalizedKeyword = normalizeKeyword(keyword)
  if (!normalizedKeyword) {
    return favorites
  }

  return favorites.filter((favorite) =>
    buildSearchableText([favorite.content, favorite.sourceTimeLabel]).includes(normalizedKeyword)
  )
}

export function filterKnowledgeBaseFavoritesByRecency(
  favorites: KnowledgeBaseFavoriteItem[],
  recencyFilter: KnowledgeBaseRecencyFilter
): KnowledgeBaseFavoriteItem[] {
  const nowTimestamp = Date.now()
  return favorites.filter((favorite) =>
    shouldKeepItemByRecency(favorite.createdAt, recencyFilter, nowTimestamp)
  )
}

export function filterKnowledgeBasePromptTemplates(
  templates: KnowledgeBasePromptTemplate[],
  keyword: string
): KnowledgeBasePromptTemplate[] {
  const normalizedKeyword = normalizeKeyword(keyword)
  if (!normalizedKeyword) {
    return templates
  }

  return templates.filter((template) =>
    buildSearchableText([template.title, template.content, template.tags.join(' ')]).includes(
      normalizedKeyword
    )
  )
}

export function filterKnowledgeBasePromptTemplatesByRecency(
  templates: KnowledgeBasePromptTemplate[],
  recencyFilter: KnowledgeBaseRecencyFilter
): KnowledgeBasePromptTemplate[] {
  const nowTimestamp = Date.now()
  return templates.filter((template) =>
    shouldKeepItemByRecency(template.updatedAt, recencyFilter, nowTimestamp)
  )
}

export function parsePromptTemplateTagsInput(value: string): string[] {
  const chunks = value
    .split(/[\n,，;；]/g)
    .map((chunk) => chunk.trim())
    .filter((chunk) => chunk.length > 0)

  return Array.from(new Set(chunks)).slice(0, 10)
}
