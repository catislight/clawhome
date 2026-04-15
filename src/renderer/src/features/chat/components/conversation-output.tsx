import { AlertCircle, CheckCheck, Loader2 } from 'lucide-react'
import { memo, useEffect, useRef, useState, type ReactNode } from 'react'

import AssistantRunTrace from '@/features/chat/components/assistant-run-trace'
import AssistantMessageActionBar from '@/features/chat/components/assistant-message-action-bar'
import AnimatedAssistantMessage from '@/features/chat/components/animated-assistant-message'
import type { ConversationRunTrace } from '@/features/chat/lib/gateway-run-trace'
import type { SshConnectionFormValues } from '@/features/instances/model/ssh-connection'
import ImagePreviewOverlay from '@/shared/ui/image-preview-overlay'
import type {
  ConversationAvatar,
  ConversationMessage,
  ConversationUserTag
} from '@/shared/contracts/chat-conversation'
import { readWorkspaceImage } from '@/shared/api/app-api'
import { useAppI18n } from '@/shared/i18n/app-i18n'
import { cn } from '@/shared/lib/utils'

type ConversationOutputProps = {
  messages: ConversationMessage[]
  messageTraces?: Record<string, ConversationRunTrace | undefined>
  connectionConfig?: SshConnectionFormValues | null
  assistantAvatar?: ConversationAvatar
  userAvatar?: ConversationAvatar
  className?: string
  innerClassName?: string
  emptyStateClassName?: string
  emptyState?: ReactNode
}

type ConversationMessageBubbleProps = {
  message: ConversationMessage
  trace?: ConversationRunTrace
  connectionConfig?: SshConnectionFormValues | null
  assistantAvatar?: ConversationAvatar
  userAvatar?: ConversationAvatar
  showAssistantAvatar: boolean
}

const CONVERSATION_BUBBLE_WIDTH_CLASS_NAME = 'w-[60%]'

function getUserTagTypeLabel(
  type: ConversationUserTag['type'],
  t: ReturnType<typeof useAppI18n>['t']
): string {
  if (type === 'image') {
    return t('chat.output.tagImage')
  }

  if (type === 'attachment') {
    return t('chat.output.tagAttachment')
  }

  return t('chat.output.tagText')
}

function AvatarBadge({
  avatar,
  fallbackEmoji
}: {
  avatar?: ConversationAvatar
  fallbackEmoji: string
}): React.JSX.Element {
  const { t } = useAppI18n()
  const avatarLabel = avatar?.label ?? t('chat.output.avatar')
  const imageSrc = avatar?.imageSrc?.trim()
  const [failedImageSrc, setFailedImageSrc] = useState<string | null>(null)
  const shouldRenderImage = Boolean(imageSrc && failedImageSrc !== imageSrc)

  if (shouldRenderImage) {
    return (
      <span
        className="inline-flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-black/10 bg-white"
        title={avatarLabel}
      >
        <img
          src={imageSrc}
          alt={avatarLabel}
          className="size-full object-cover"
          referrerPolicy="no-referrer"
          onError={() => setFailedImageSrc(imageSrc ?? null)}
        />
      </span>
    )
  }

  return (
    <span
      aria-label={avatarLabel}
      className="inline-flex size-9 shrink-0 items-center justify-center rounded-full border border-black/10 bg-white text-base leading-none"
      title={avatarLabel}
    >
      {(avatar?.emoji?.trim() || fallbackEmoji).slice(0, 2)}
    </span>
  )
}

function ConversationMessageBubble({
  message,
  trace,
  connectionConfig,
  assistantAvatar,
  userAvatar,
  showAssistantAvatar
}: ConversationMessageBubbleProps): React.JSX.Element {
  const { t } = useAppI18n()
  const assistantContent = message.content.trim()
  const [imagePreviewModal, setImagePreviewModal] = useState<{
    src: string
    label: string
  } | null>(null)
  const [loadingTagKey, setLoadingTagKey] = useState<string | null>(null)
  const [resolvedPreviewSrcByTagKey, setResolvedPreviewSrcByTagKey] = useState<
    Record<string, string>
  >({})
  const showAssistantActionBar = message.role === 'assistant' && assistantContent.length > 0
  const isAssistant = message.role === 'assistant'
  const shouldHideInlineAssistantLoading = Boolean(
    isAssistant &&
    assistantContent.length === 0 &&
    trace &&
    (trace.activeToolCallIds.length > 0 || trace.isGenerating)
  )
  const avatar = isAssistant ? assistantAvatar : userAvatar
  const fallbackEmoji = isAssistant ? '🤖' : '🧑'
  const visibleUserTags = (message.tags ?? []).filter((tag) => tag.label.trim().length > 0)

  const handleOpenImagePreview = async (
    tag: ConversationUserTag,
    tagKey: string
  ): Promise<void> => {
    const directPreviewSrc = tag.previewSrc?.trim()
    if (directPreviewSrc) {
      setImagePreviewModal({
        src: directPreviewSrc,
        label: tag.label
      })
      return
    }

    const cachedPreviewSrc = resolvedPreviewSrcByTagKey[tagKey]
    if (cachedPreviewSrc) {
      setImagePreviewModal({
        src: cachedPreviewSrc,
        label: tag.label
      })
      return
    }

    const absolutePath = tag.absolutePath?.trim()
    const relativePath = tag.relativePath?.trim()
    if (!absolutePath && !relativePath) {
      return
    }

    setLoadingTagKey(tagKey)
    try {
      const response = await readWorkspaceImage({
        absolutePath: absolutePath || undefined,
        relativePath: relativePath || undefined,
        connection: connectionConfig ?? undefined
      })
      if (!response.success || !response.base64Data) {
        return
      }

      const previewSrc = `data:${response.mimeType || 'application/octet-stream'};base64,${response.base64Data}`
      setResolvedPreviewSrcByTagKey((current) => ({
        ...current,
        [tagKey]: previewSrc
      }))
      setImagePreviewModal({
        src: previewSrc,
        label: tag.label
      })
    } finally {
      setLoadingTagKey(null)
    }
  }

  const bubble = (
    <article
      className={cn(
        `group/message ${CONVERSATION_BUBBLE_WIDTH_CLASS_NAME} rounded-[1rem] border px-4 py-3 text-sm leading-6 shadow-[0_14px_32px_-28px_rgba(15,23,42,0.24)]`,
        message.status === 'error' && message.role === 'assistant'
          ? 'border-rose-200 bg-rose-50/80 text-rose-950'
          : null,
        message.role === 'assistant'
          ? 'border-black/7 bg-[#FCFCFD] text-foreground'
          : 'border-[#D6E5FF] bg-[#EAF3FF] text-foreground'
      )}
    >
      {message.role === 'assistant' ? (
        <>
          {trace ? <AssistantRunTrace trace={trace} variant="embedded" /> : null}
          {shouldHideInlineAssistantLoading ? null : (
            <AnimatedAssistantMessage content={message.content} status={message.status} />
          )}
        </>
      ) : null}
      {message.role === 'user' ? (
        <>
          {visibleUserTags.length > 0 ? (
            <div className="mb-2 flex flex-wrap gap-1.5">
              {visibleUserTags.map((tag, index) =>
                (() => {
                  const tagKey = `${tag.type}-${tag.label}-${index}`
                  const previewSrc = tag.previewSrc?.trim() || resolvedPreviewSrcByTagKey[tagKey]
                  const canPreview = tag.type === 'image' && Boolean(previewSrc)
                  const baseClassName =
                    'inline-flex items-center gap-1 rounded-md border border-[#D1DDF5] bg-white/65 px-2 py-0.5 text-xs text-[#1E293B]'
                  const isLoading = loadingTagKey === tagKey

                  if (!canPreview) {
                    const canLoadFromPath =
                      tag.type === 'image' &&
                      (Boolean(tag.absolutePath?.trim()) || Boolean(tag.relativePath?.trim()))

                    if (!canLoadFromPath) {
                      return (
                        <span key={tagKey} className={baseClassName}>
                          <span className="rounded bg-[#E2E8F0] px-1 py-[1px] text-[10px] font-semibold text-[#334155]">
                            {getUserTagTypeLabel(tag.type, t)}
                          </span>
                          <span className="max-w-[14rem] truncate">{tag.label}</span>
                        </span>
                      )
                    }

                    return (
                      <button
                        key={tagKey}
                        type="button"
                        className={cn(
                          baseClassName,
                          'cursor-pointer transition-colors hover:border-[#9FC2FF] hover:bg-white/85'
                        )}
                        onClick={() => {
                          void handleOpenImagePreview(tag, tagKey)
                        }}
                      >
                        <span className="rounded bg-[#E2E8F0] px-1 py-[1px] text-[10px] font-semibold text-[#334155]">
                          {getUserTagTypeLabel(tag.type, t)}
                        </span>
                        <span className="max-w-[14rem] truncate">
                          {isLoading ? t('chat.output.loadingTag', { label: tag.label }) : tag.label}
                        </span>
                      </button>
                    )
                  }

                  return (
                    <button
                      key={tagKey}
                      type="button"
                      className={cn(
                        baseClassName,
                        'cursor-pointer transition-colors hover:border-[#9FC2FF] hover:bg-white/85'
                      )}
                      onClick={() => {
                        void handleOpenImagePreview(tag, tagKey)
                      }}
                    >
                        <span className="rounded bg-[#E2E8F0] px-1 py-[1px] text-[10px] font-semibold text-[#334155]">
                          {getUserTagTypeLabel(tag.type, t)}
                        </span>
                        <span className="max-w-[14rem] truncate">{tag.label}</span>
                      </button>
                  )
                })()
              )}
            </div>
          ) : null}
          {message.content.trim().length > 0 ? (
            <p className="whitespace-pre-wrap break-words">{message.content}</p>
          ) : null}
        </>
      ) : null}

      <div
        className={cn(
          'mt-1.5 flex items-center gap-3 text-[11px] text-[#6E7A8B]',
          showAssistantActionBar ? 'justify-between' : 'justify-end'
        )}
      >
        {showAssistantActionBar ? (
          <AssistantMessageActionBar
            content={message.content}
            messageId={message.id}
            runId={message.runId}
            timeLabel={message.timeLabel}
            className="opacity-45 transition-opacity duration-150 group-hover/message:opacity-100"
          />
        ) : null}

        <div className="flex items-center justify-end gap-1.5">
          <span>{message.timeLabel}</span>
          {message.role === 'user' ? (
            message.status === 'sending' ? (
              <Loader2 aria-label={t('chat.output.statusSending')} className="size-3.5 animate-spin" />
            ) : message.status === 'error' ? (
              <AlertCircle aria-label={t('chat.output.statusFailed')} className="size-3.5 text-rose-600" />
            ) : (
              <CheckCheck aria-label={t('chat.output.statusSent')} className="size-3.5" />
            )
          ) : null}
        </div>
      </div>
    </article>
  )

  return (
    <>
      <div className={cn('flex items-start gap-2', isAssistant ? 'justify-start' : 'justify-end')}>
        {isAssistant ? (
          <>
            {showAssistantAvatar ? (
              <AvatarBadge avatar={avatar} fallbackEmoji={fallbackEmoji} />
            ) : (
              <span aria-hidden className="inline-flex size-9 shrink-0" />
            )}
            {bubble}
          </>
        ) : (
          <>
            {bubble}
            <AvatarBadge avatar={avatar} fallbackEmoji={fallbackEmoji} />
          </>
        )}
      </div>

      {imagePreviewModal ? (
        <ImagePreviewOverlay
          src={imagePreviewModal.src}
          alt={imagePreviewModal.label}
          onClose={() => setImagePreviewModal(null)}
        />
      ) : null}
    </>
  )
}

const MemoizedConversationMessageBubble = memo(
  ConversationMessageBubble,
  (previousProps, nextProps) =>
    previousProps.message === nextProps.message &&
    previousProps.trace === nextProps.trace &&
    previousProps.connectionConfig === nextProps.connectionConfig &&
    previousProps.assistantAvatar === nextProps.assistantAvatar &&
    previousProps.userAvatar === nextProps.userAvatar &&
    previousProps.showAssistantAvatar === nextProps.showAssistantAvatar
)

function ConversationOutput({
  messages,
  messageTraces,
  connectionConfig,
  assistantAvatar,
  userAvatar,
  className,
  innerClassName,
  emptyStateClassName,
  emptyState
}: ConversationOutputProps): React.JSX.Element {
  const endRef = useRef<HTMLDivElement | null>(null)
  const renderedTraceRunIds = new Set<string>()
  const lastMessage = messages.at(-1)
  const lastMessageTrace = lastMessage?.runId ? messageTraces?.[lastMessage.runId] : undefined

  useEffect(() => {
    endRef.current?.scrollIntoView({
      block: 'end'
    })
  }, [
    messages.length,
    lastMessage?.id,
    lastMessage?.content,
    lastMessage?.status,
    lastMessageTrace?.isGenerating,
    lastMessageTrace?.activeToolCallIds.length
  ])

  return (
    <div aria-live="polite" className={cn('min-h-0 flex-1 overflow-y-auto', className)} role="log">
      {messages.length === 0 && emptyState ? (
        <div
          className={cn(
            'flex h-full min-h-[18rem] items-center justify-center',
            emptyStateClassName
          )}
        >
          {emptyState}
        </div>
      ) : (
        <div className={cn('space-y-2.5 py-3', innerClassName)}>
          {messages.map((message, index) => {
            const trace =
              message.role === 'assistant' && message.runId
                ? messageTraces?.[message.runId]
                : undefined
            const shouldRenderEmbeddedTrace = Boolean(
              trace &&
              message.runId &&
              !renderedTraceRunIds.has(message.runId) &&
              (trace.skills.length > 0 || trace.tools.length > 0) &&
              (message.content.trim().length > 0 ||
                trace.activeToolCallIds.length > 0 ||
                trace.isGenerating)
            )

            if (shouldRenderEmbeddedTrace && message.runId) {
              renderedTraceRunIds.add(message.runId)
            }

            const previousMessage = index > 0 ? messages[index - 1] : undefined
            const showAssistantAvatar =
              message.role !== 'assistant' || previousMessage?.role !== 'assistant'

            return (
              <MemoizedConversationMessageBubble
                key={message.id}
                message={message}
                trace={shouldRenderEmbeddedTrace ? trace : undefined}
                connectionConfig={connectionConfig}
                assistantAvatar={assistantAvatar}
                userAvatar={userAvatar}
                showAssistantAvatar={showAssistantAvatar}
              />
            )
          })}

          <div ref={endRef} />
        </div>
      )}
    </div>
  )
}

export default ConversationOutput
