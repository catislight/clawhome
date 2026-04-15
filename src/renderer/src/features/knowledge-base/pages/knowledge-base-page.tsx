import { Check, Copy, Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { useMemo, useState, type Dispatch, type SetStateAction } from 'react'

import PromptTemplateEditorDialog from '@/features/knowledge-base/components/prompt-template-editor-dialog'
import {
  filterKnowledgeBaseFavorites,
  filterKnowledgeBaseFavoritesByRecency,
  filterKnowledgeBasePromptTemplatesByRecency,
  filterKnowledgeBasePromptTemplates,
  formatKnowledgeBaseTimestamp,
  parsePromptTemplateTagsInput,
  type KnowledgeBaseRecencyFilter
} from '@/features/knowledge-base/lib/knowledge-base-presenters'
import {
  useKnowledgeBaseStore,
  type KnowledgeBasePromptTemplate
} from '@/features/knowledge-base/store/use-knowledge-base-store'
import { useCopyToClipboard } from '@/shared/hooks/use-copy-to-clipboard'
import { useAppI18n } from '@/shared/i18n/app-i18n'
import AppShellContentArea from '@/shared/layout/app-shell-content-area'
import { cn } from '@/shared/lib/utils'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { Select, type SelectOption } from '@/shared/ui/select'

type KnowledgeBaseTab = 'favorites' | 'templates'

function KnowledgeBasePage(): React.JSX.Element {
  const { t } = useAppI18n()
  const favorites = useKnowledgeBaseStore((state) => state.favorites)
  const promptTemplates = useKnowledgeBaseStore((state) => state.promptTemplates)
  const removeFavorite = useKnowledgeBaseStore((state) => state.removeFavorite)
  const createPromptTemplate = useKnowledgeBaseStore((state) => state.createPromptTemplate)
  const updatePromptTemplate = useKnowledgeBaseStore((state) => state.updatePromptTemplate)
  const deletePromptTemplate = useKnowledgeBaseStore((state) => state.deletePromptTemplate)

  const [activeTab, setActiveTab] = useState<KnowledgeBaseTab>('favorites')
  const [keyword, setKeyword] = useState('')
  const [recencyFilter, setRecencyFilter] = useState<KnowledgeBaseRecencyFilter>('all')
  const [copiedFavoriteId, setCopiedFavoriteId] = useState<string | null>(null)
  const [copiedTemplateId, setCopiedTemplateId] = useState<string | null>(null)
  const [editorOpen, setEditorOpen] = useState(false)
  const [editorMode, setEditorMode] = useState<'create' | 'edit'>('create')
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null)
  const [editorTitle, setEditorTitle] = useState('')
  const [editorContent, setEditorContent] = useState('')
  const [editorTagsInput, setEditorTagsInput] = useState('')
  const [editorError, setEditorError] = useState<string | null>(null)

  const { copy } = useCopyToClipboard()
  const recencyFilterOptions = useMemo<SelectOption[]>(
    () => [
      {
        value: 'all',
        label: t('knowledgeBase.filter.recency.all')
      },
      {
        value: '7d',
        label: t('knowledgeBase.filter.recency.7d')
      },
      {
        value: '30d',
        label: t('knowledgeBase.filter.recency.30d')
      }
    ],
    [t]
  )

  const visibleFavorites = useMemo(
    () =>
      filterKnowledgeBaseFavoritesByRecency(
        filterKnowledgeBaseFavorites(favorites, keyword),
        recencyFilter
      ),
    [favorites, keyword, recencyFilter]
  )
  const visiblePromptTemplates = useMemo(
    () =>
      filterKnowledgeBasePromptTemplatesByRecency(
        filterKnowledgeBasePromptTemplates(promptTemplates, keyword),
        recencyFilter
      ),
    [keyword, promptTemplates, recencyFilter]
  )

  const emptyStateDescription =
    activeTab === 'favorites'
      ? t('knowledgeBase.empty.favorites.description')
      : t('knowledgeBase.empty.templates.description')

  const openCreateTemplateDialog = (): void => {
    setEditorMode('create')
    setEditingTemplateId(null)
    setEditorTitle('')
    setEditorContent('')
    setEditorTagsInput('')
    setEditorError(null)
    setEditorOpen(true)
  }

  const openEditTemplateDialog = (template: KnowledgeBasePromptTemplate): void => {
    setEditorMode('edit')
    setEditingTemplateId(template.id)
    setEditorTitle(template.title)
    setEditorContent(template.content)
    setEditorTagsInput(template.tags.join(', '))
    setEditorError(null)
    setEditorOpen(true)
  }

  const closeEditorDialog = (): void => {
    setEditorOpen(false)
    setEditorError(null)
  }

  const flashCopiedState = (
    setCopiedId: Dispatch<SetStateAction<string | null>>,
    itemId: string
  ): void => {
    setCopiedId(itemId)
    window.setTimeout(() => {
      setCopiedId((current) => (current === itemId ? null : current))
    }, 1400)
  }

  const handleCopyFavorite = (favoriteId: string, content: string): void => {
    void copy(content).then((copied) => {
      if (!copied) {
        return
      }

      flashCopiedState(setCopiedFavoriteId, favoriteId)
    })
  }

  const handleCopyPromptTemplate = (templateId: string, content: string): void => {
    void copy(content).then((copied) => {
      if (!copied) {
        return
      }

      flashCopiedState(setCopiedTemplateId, templateId)
    })
  }

  const handleSubmitEditor = (): void => {
    const title = editorTitle.trim()
    const content = editorContent.trim()
    if (!title || !content) {
      setEditorError(t('knowledgeBase.error.editor.requiredFields'))
      return
    }

    const tags = parsePromptTemplateTagsInput(editorTagsInput)
    if (editorMode === 'create') {
      const templateId = createPromptTemplate({
        title,
        content,
        tags
      })
      if (!templateId) {
        setEditorError(t('knowledgeBase.error.editor.saveFailed'))
        return
      }

      closeEditorDialog()
      return
    }

    if (!editingTemplateId) {
      setEditorError(t('knowledgeBase.error.editor.missingTemplate'))
      return
    }

    updatePromptTemplate(editingTemplateId, {
      title,
      content,
      tags
    })
    closeEditorDialog()
  }

  return (
    <>
      <AppShellContentArea
        showHeaderWithoutConnectedInstance
        disableInnerPadding
        contentScrollable={false}
        innerClassName="h-full min-h-0 gap-0"
        headerClassName="px-4"
        header={
          <div className="flex w-full min-w-0 items-center justify-between gap-3">
            <div className="inline-flex items-center gap-1 rounded-[0.75rem] border border-black/8 bg-[#F8FAFD] p-1">
              <button
                type="button"
                className={cn(
                  'inline-flex h-7 items-center rounded-[0.55rem] px-2.5 text-xs font-medium transition-colors',
                  activeTab === 'favorites'
                    ? 'bg-white text-foreground shadow-[0_8px_16px_-14px_rgba(15,23,42,0.32)]'
                    : 'text-muted-foreground hover:text-foreground'
                )}
                onClick={() => {
                  setActiveTab('favorites')
                }}
              >
                {t('knowledgeBase.tab.favorites')}
              </button>
              <button
                type="button"
                className={cn(
                  'inline-flex h-7 items-center rounded-[0.55rem] px-2.5 text-xs font-medium transition-colors',
                  activeTab === 'templates'
                    ? 'bg-white text-foreground shadow-[0_8px_16px_-14px_rgba(15,23,42,0.32)]'
                    : 'text-muted-foreground hover:text-foreground'
                )}
                onClick={() => {
                  setActiveTab('templates')
                }}
              >
                {t('knowledgeBase.tab.templates')}
              </button>
            </div>

            <div className="flex shrink-0 items-center gap-3">
              <div className="w-8">
                {activeTab === 'templates' ? (
                  <Button
                    type="button"
                    className="size-8 rounded-[0.7rem] p-0"
                    aria-label={t('knowledgeBase.action.createTemplate')}
                    title={t('knowledgeBase.action.createTemplate')}
                    onClick={openCreateTemplateDialog}
                  >
                    <Plus className="size-3.5" />
                  </Button>
                ) : null}
              </div>
            </div>
          </div>
        }
      >
        <section className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <section className="shrink-0 border-b border-black/6 px-4 py-3">
            <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_9.5rem]">
              <div className="relative">
                <Search
                  className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
                  aria-hidden="true"
                />
                <Input
                  density="sm"
                  value={keyword}
                  className="pl-8"
                  placeholder={
                    activeTab === 'favorites'
                      ? t('knowledgeBase.search.favorites')
                      : t('knowledgeBase.search.templates')
                  }
                  onChange={(event) => {
                    setKeyword(event.target.value)
                  }}
                />
              </div>

              <Select
                value={recencyFilter}
                options={recencyFilterOptions}
                ariaLabel={t('knowledgeBase.filter.recency.aria')}
                triggerClassName="h-9 rounded-[0.7rem] px-3 text-xs font-medium"
                onValueChange={(value) => {
                  setRecencyFilter(value as KnowledgeBaseRecencyFilter)
                }}
              />
            </div>
          </section>

          <section className="min-h-0 flex-1 px-4 py-3">
            <section className="h-full min-h-0 overflow-hidden rounded-[0.8rem] border border-black/8 bg-white">
              {activeTab === 'favorites' ? (
                visibleFavorites.length === 0 ? (
                  <div className="flex h-full min-h-[220px] flex-col items-center justify-center px-6 text-center">
                    <p className="text-sm font-medium text-foreground">
                      {t('knowledgeBase.empty.favorites.title')}
                    </p>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      {emptyStateDescription}
                    </p>
                  </div>
                ) : (
                  <div className="h-full overflow-y-auto">
                    {visibleFavorites.map((favorite) => {
                      const copied = copiedFavoriteId === favorite.id

                      return (
                        <article
                          key={favorite.id}
                          className="border-b border-black/6 px-4 py-3 last:border-b-0"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <p className="whitespace-pre-wrap break-words text-sm leading-6 text-foreground">
                              {favorite.content}
                            </p>

                            <div className="flex shrink-0 items-center gap-1">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                aria-label={
                                  copied
                                    ? t('knowledgeBase.favorite.copied')
                                    : t('knowledgeBase.favorite.copy')
                                }
                                title={
                                  copied
                                    ? t('knowledgeBase.favorite.copied')
                                    : t('knowledgeBase.favorite.copy')
                                }
                                className="size-7 rounded-[0.55rem] text-muted-foreground hover:bg-black/[0.04] hover:text-foreground"
                                onClick={() => {
                                  handleCopyFavorite(favorite.id, favorite.content)
                                }}
                              >
                                {copied ? (
                                  <Check className="size-3.5" />
                                ) : (
                                  <Copy className="size-3.5" />
                                )}
                              </Button>

                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                aria-label={t('knowledgeBase.favorite.delete')}
                                title={t('knowledgeBase.favorite.delete')}
                                className="size-7 rounded-[0.55rem] text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                                onClick={() => {
                                  removeFavorite(favorite.id)
                                }}
                              >
                                <Trash2 className="size-3.5" />
                              </Button>
                            </div>
                          </div>

                          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                            <span>
                              {t('knowledgeBase.favorite.collectedAt', {
                                time: formatKnowledgeBaseTimestamp(favorite.createdAt)
                              })}
                            </span>
                            {favorite.sourceTimeLabel ? (
                              <span>
                                {t('knowledgeBase.favorite.sourceTime', {
                                  time: favorite.sourceTimeLabel
                                })}
                              </span>
                            ) : null}
                          </div>
                        </article>
                      )
                    })}
                  </div>
                )
              ) : visiblePromptTemplates.length === 0 ? (
                <div className="flex h-full min-h-[220px] flex-col items-center justify-center px-6 text-center">
                  <p className="text-sm font-medium text-foreground">
                    {t('knowledgeBase.empty.templates.title')}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    {emptyStateDescription}
                  </p>
                </div>
              ) : (
                <div className="h-full overflow-y-auto">
                  {visiblePromptTemplates.map((template) => {
                    const copied = copiedTemplateId === template.id

                    return (
                      <article
                        key={template.id}
                        className="border-b border-black/6 px-4 py-3 last:border-b-0"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex min-w-0 flex-wrap items-center gap-2">
                              <h3 className="truncate text-sm font-medium text-foreground">
                                {template.title}
                              </h3>
                              {template.tags.map((tag) => (
                                <span
                                  key={`${template.id}-${tag}`}
                                  className="inline-flex rounded border border-[#DDE4EF] bg-[#F8FAFD] px-1.5 py-[1px] text-[10px] text-muted-foreground"
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>

                            <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6 text-foreground">
                              {template.content}
                            </p>

                            <div className="mt-2 text-[11px] text-muted-foreground">
                              {t('knowledgeBase.template.updatedAt', {
                                time: formatKnowledgeBaseTimestamp(template.updatedAt)
                              })}
                            </div>
                          </div>

                          <div className="flex shrink-0 items-center gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              aria-label={
                                copied
                                  ? t('knowledgeBase.template.copied')
                                  : t('knowledgeBase.template.copy')
                              }
                              title={
                                copied
                                  ? t('knowledgeBase.template.copied')
                                  : t('knowledgeBase.template.copy')
                              }
                              className="size-7 rounded-[0.55rem] text-muted-foreground hover:bg-black/[0.04] hover:text-foreground"
                              onClick={() => {
                                handleCopyPromptTemplate(template.id, template.content)
                              }}
                            >
                              {copied ? (
                                <Check className="size-3.5" />
                              ) : (
                                <Copy className="size-3.5" />
                              )}
                            </Button>

                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              aria-label={t('knowledgeBase.template.edit')}
                              title={t('knowledgeBase.template.edit')}
                              className="size-7 rounded-[0.55rem] text-muted-foreground hover:bg-black/[0.04] hover:text-foreground"
                              onClick={() => {
                                openEditTemplateDialog(template)
                              }}
                            >
                              <Pencil className="size-3.5" />
                            </Button>

                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              aria-label={t('knowledgeBase.template.delete')}
                              title={t('knowledgeBase.template.delete')}
                              className="size-7 rounded-[0.55rem] text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                              onClick={() => {
                                const confirmed = window.confirm(
                                  t('knowledgeBase.template.confirmDelete', {
                                    title: template.title
                                  })
                                )
                                if (!confirmed) {
                                  return
                                }

                                deletePromptTemplate(template.id)
                              }}
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          </div>
                        </div>
                      </article>
                    )
                  })}
                </div>
              )}
            </section>
          </section>
        </section>
      </AppShellContentArea>

      <PromptTemplateEditorDialog
        open={editorOpen}
        mode={editorMode}
        title={editorTitle}
        content={editorContent}
        tagsInput={editorTagsInput}
        error={editorError}
        onClose={closeEditorDialog}
        onTitleChange={(value) => {
          setEditorTitle(value)
          setEditorError(null)
        }}
        onContentChange={(value) => {
          setEditorContent(value)
          setEditorError(null)
        }}
        onTagsInputChange={(value) => {
          setEditorTagsInput(value)
        }}
        onSubmit={handleSubmitEditor}
      />
    </>
  )
}

export default KnowledgeBasePage
