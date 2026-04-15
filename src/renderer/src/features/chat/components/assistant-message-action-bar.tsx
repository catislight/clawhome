import { Check, Copy, Star } from 'lucide-react'

import { useKnowledgeBaseStore } from '@/features/knowledge-base/store/use-knowledge-base-store'
import { Button } from '@/shared/ui/button'
import { useCopyToClipboard } from '@/shared/hooks/use-copy-to-clipboard'
import { useAppI18n } from '@/shared/i18n/app-i18n'
import { cn } from '@/shared/lib/utils'

type AssistantMessageActionBarProps = {
  content: string
  messageId?: string
  runId?: string
  timeLabel?: string
  className?: string
}

function AssistantMessageActionBar({
  content,
  messageId,
  runId,
  timeLabel,
  className
}: AssistantMessageActionBarProps): React.JSX.Element {
  const { t } = useAppI18n()
  const { copied, copyError, copy } = useCopyToClipboard()
  const addFavorite = useKnowledgeBaseStore((state) => state.addFavorite)
  const favoriteDisabled = content.trim().length === 0
  const favorited = useKnowledgeBaseStore((state) => state.hasFavoriteContent(content))

  return (
    <div className={cn('inline-flex items-center gap-0.5 text-[#95A0B0]', className)}>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label={copied ? t('chat.assistantAction.replyCopied') : t('chat.assistantAction.copyReply')}
        title={copyError ?? (copied ? t('chat.assistantAction.replyCopied') : t('chat.assistantAction.copyReply'))}
        className={cn(
          'size-[1.4rem] rounded-[0.45rem] text-current hover:bg-secondary/80 hover:text-foreground',
          copied ? 'bg-secondary/90 text-foreground' : null
        )}
        onClick={() => {
          void copy(content)
        }}
      >
        {copied ? <Check className="size-[0.9rem]" /> : <Copy className="size-[0.9rem]" />}
      </Button>

      <Button
        type="button"
        variant="ghost"
        size="icon"
        disabled={favoriteDisabled}
        aria-label={
          favorited ? t('chat.assistantAction.replyFavorited') : t('chat.assistantAction.favoriteReply')
        }
        title={favorited ? t('chat.assistantAction.replyFavorited') : t('chat.assistantAction.favoriteReply')}
        className={cn(
          'size-[1.4rem] rounded-[0.45rem] text-current hover:bg-secondary/80 hover:text-foreground',
          favorited ? 'bg-amber-50 text-amber-600 hover:bg-amber-100 hover:text-amber-700' : null
        )}
        onClick={() => {
          if (favorited || favoriteDisabled) {
            return
          }

          addFavorite({
            content,
            sourceMessageId: messageId,
            sourceRunId: runId,
            sourceTimeLabel: timeLabel
          })
        }}
      >
        <Star className={cn('size-[0.9rem]', favorited && 'fill-current')} />
      </Button>
    </div>
  )
}

export default AssistantMessageActionBar
