import { memo } from 'react'
import { Loader2 } from 'lucide-react'

import ConversationOutput from '@/features/chat/components/conversation-output'
import type { ConversationRunTrace } from '@/features/chat/lib/gateway-run-trace'
import type { SshConnectionFormValues } from '@/features/instances/model/ssh-connection'
import type { ConversationAvatar } from '@/shared/contracts/chat-conversation'
import { useAppI18n } from '@/shared/i18n/app-i18n'

type ChatTranscriptProps = {
  messages: Parameters<typeof ConversationOutput>[0]['messages']
  messageTraces: Parameters<typeof ConversationOutput>[0]['messageTraces']
  connectionConfig?: SshConnectionFormValues | null
  loadingHistory?: boolean
  historyError?: string | null
  activeInstanceName?: string
  assistantAvatar?: ConversationAvatar
  userAvatar?: ConversationAvatar
  className?: string
  innerClassName?: string
  emptyStateClassName?: string
  emptyState?: React.ReactNode
}

function ChatTranscript({
  messages,
  messageTraces,
  connectionConfig,
  loadingHistory,
  historyError,
  activeInstanceName,
  assistantAvatar,
  userAvatar,
  className,
  innerClassName,
  emptyStateClassName,
  emptyState: customEmptyState
}: ChatTranscriptProps): React.JSX.Element {
  const { t } = useAppI18n()

  const emptyState =
    customEmptyState ??
    (loadingHistory ? (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        <span>{t('chat.transcript.syncing')}</span>
      </div>
    ) : historyError ? (
      <div className="max-w-md text-center">
        <p className="text-sm font-medium text-foreground">{t('chat.transcript.unavailable')}</p>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{historyError}</p>
      </div>
    ) : (
      <div className="max-w-md text-center">
        <p className="text-sm font-medium text-foreground">
          {t('chat.transcript.connectedTo', { name: activeInstanceName ?? '' })}
        </p>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{t('chat.transcript.ready')}</p>
      </div>
    ))

  return (
    <ConversationOutput
      messages={messages}
      messageTraces={messageTraces as Record<string, ConversationRunTrace> | undefined}
      connectionConfig={connectionConfig}
      assistantAvatar={assistantAvatar}
      userAvatar={userAvatar}
      className={className}
      innerClassName={innerClassName}
      emptyStateClassName={emptyStateClassName}
      emptyState={emptyState}
    />
  )
}

export default memo(ChatTranscript)
