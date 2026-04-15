import { Loader2 } from 'lucide-react'

import MarkdownContent from '@/features/chat/components/markdown-content'
import type { ConversationMessageStatus } from '@/shared/contracts/chat-conversation'
import { useTypewriterText } from '@/shared/hooks/use-typewriter-text'
import { useAppI18n } from '@/shared/i18n/app-i18n'

type AnimatedAssistantMessageProps = {
  content: string
  status?: ConversationMessageStatus
}

function AnimatedAssistantMessage({
  content,
  status
}: AnimatedAssistantMessageProps): React.JSX.Element {
  const { t } = useAppI18n()
  const shouldTypewrite = status === 'streaming'
  const { displayedText, isAnimating } = useTypewriterText({
    text: content,
    enabled: shouldTypewrite
  })
  const shouldAnimateCharacters = shouldTypewrite || isAnimating

  if (!content) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 aria-hidden="true" className="size-4 animate-spin" />
        <span>{t('chat.animated.generating')}</span>
      </div>
    )
  }

  return (
    <>
      <MarkdownContent
        className="streaming-assistant-text text-[14px] leading-6"
        content={shouldAnimateCharacters ? displayedText : content}
        optimistic={shouldAnimateCharacters}
        animateCharacters={shouldAnimateCharacters}
      />
    </>
  )
}

export default AnimatedAssistantMessage
