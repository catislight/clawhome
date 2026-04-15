import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

export type KnowledgeBaseFavoriteItem = {
  id: string
  content: string
  normalizedContent: string
  createdAt: string
  sourceMessageId: string | null
  sourceRunId: string | null
  sourceTimeLabel: string | null
}

export type KnowledgeBasePromptTemplate = {
  id: string
  title: string
  content: string
  tags: string[]
  createdAt: string
  updatedAt: string
}

type AddFavoritePayload = {
  content: string
  sourceMessageId?: string | null
  sourceRunId?: string | null
  sourceTimeLabel?: string | null
}

type UpsertPromptTemplatePayload = {
  title: string
  content: string
  tags?: string[]
}

type AddFavoriteResult = {
  added: boolean
  id: string | null
}

type KnowledgeBaseStoreState = {
  favorites: KnowledgeBaseFavoriteItem[]
  promptTemplates: KnowledgeBasePromptTemplate[]
}

type KnowledgeBaseStoreActions = {
  addFavorite: (payload: AddFavoritePayload) => AddFavoriteResult
  removeFavorite: (favoriteId: string) => void
  hasFavoriteContent: (content: string) => boolean
  createPromptTemplate: (payload: UpsertPromptTemplatePayload) => string | null
  updatePromptTemplate: (templateId: string, payload: UpsertPromptTemplatePayload) => void
  deletePromptTemplate: (templateId: string) => void
  resetStore: () => void
}

type KnowledgeBaseStore = KnowledgeBaseStoreState & KnowledgeBaseStoreActions

const KNOWLEDGE_BASE_STORE_PERSIST_KEY = 'openclaw-knowledge-base-store'

export function normalizeKnowledgeBaseContent(value: string): string {
  return value.replace(/\r\n/g, '\n').trim()
}

function normalizeKnowledgeBaseTag(value: string): string {
  return value.trim()
}

function normalizeKnowledgeBaseTags(tags: string[]): string[] {
  const normalizedTags = tags
    .map((tag) => normalizeKnowledgeBaseTag(tag))
    .filter((tag) => tag.length > 0)

  return Array.from(new Set(normalizedTags)).slice(0, 10)
}

export function createInitialKnowledgeBaseStoreState(): KnowledgeBaseStoreState {
  return {
    favorites: [],
    promptTemplates: []
  }
}

function createKnowledgeBaseId(prefix: 'favorite' | 'template'): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export const useKnowledgeBaseStore = create<KnowledgeBaseStore>()(
  persist(
    (set, get) => ({
      ...createInitialKnowledgeBaseStoreState(),
      addFavorite: (payload) => {
        const normalizedContent = normalizeKnowledgeBaseContent(payload.content)
        if (!normalizedContent) {
          return {
            added: false,
            id: null
          }
        }

        const existingFavorite = get().favorites.find(
          (favorite) => favorite.normalizedContent === normalizedContent
        )
        if (existingFavorite) {
          return {
            added: false,
            id: existingFavorite.id
          }
        }

        const favoriteId = createKnowledgeBaseId('favorite')
        const createdAt = new Date().toISOString()

        set((state) => ({
          favorites: [
            {
              id: favoriteId,
              content: normalizedContent,
              normalizedContent,
              createdAt,
              sourceMessageId: payload.sourceMessageId ?? null,
              sourceRunId: payload.sourceRunId ?? null,
              sourceTimeLabel: payload.sourceTimeLabel ?? null
            },
            ...state.favorites
          ]
        }))

        return {
          added: true,
          id: favoriteId
        }
      },
      removeFavorite: (favoriteId) => {
        set((state) => ({
          favorites: state.favorites.filter((favorite) => favorite.id !== favoriteId)
        }))
      },
      hasFavoriteContent: (content) => {
        const normalizedContent = normalizeKnowledgeBaseContent(content)
        if (!normalizedContent) {
          return false
        }

        return get().favorites.some((favorite) => favorite.normalizedContent === normalizedContent)
      },
      createPromptTemplate: (payload) => {
        const title = payload.title.trim()
        const content = normalizeKnowledgeBaseContent(payload.content)

        if (!title || !content) {
          return null
        }

        const now = new Date().toISOString()
        const templateId = createKnowledgeBaseId('template')

        set((state) => ({
          promptTemplates: [
            {
              id: templateId,
              title,
              content,
              tags: normalizeKnowledgeBaseTags(payload.tags ?? []),
              createdAt: now,
              updatedAt: now
            },
            ...state.promptTemplates
          ]
        }))

        return templateId
      },
      updatePromptTemplate: (templateId, payload) => {
        const title = payload.title.trim()
        const content = normalizeKnowledgeBaseContent(payload.content)
        if (!title || !content) {
          return
        }

        set((state) => ({
          promptTemplates: state.promptTemplates.map((template) =>
            template.id === templateId
              ? {
                  ...template,
                  title,
                  content,
                  tags: normalizeKnowledgeBaseTags(payload.tags ?? []),
                  updatedAt: new Date().toISOString()
                }
              : template
          )
        }))
      },
      deletePromptTemplate: (templateId) => {
        set((state) => ({
          promptTemplates: state.promptTemplates.filter((template) => template.id !== templateId)
        }))
      },
      resetStore: () => {
        set(createInitialKnowledgeBaseStoreState())
      }
    }),
    {
      name: KNOWLEDGE_BASE_STORE_PERSIST_KEY,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        favorites: state.favorites,
        promptTemplates: state.promptTemplates
      })
    }
  )
)
