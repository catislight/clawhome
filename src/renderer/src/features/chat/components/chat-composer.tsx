import type { ReactNode } from 'react'

import ConversationInput from '@/features/chat/components/conversation-input'
import type { ChatSubmitPayload } from '@/features/chat/lib/chat-send-types'

type ChatComposerProps = {
  onSubmit: (payload: ChatSubmitPayload) => Promise<void> | void
  ariaLabel?: string
  placeholder?: string
  submitLabel?: string
  disabled?: boolean
  submitting?: boolean
  showShortcutHint?: boolean
  shortcutHint?: string
  sendShortcuts?: string[]
  showSubmitText?: boolean
  footerLeading?: ReactNode
  className?: string
}

function ChatComposer({
  onSubmit,
  ariaLabel,
  placeholder,
  submitLabel,
  disabled,
  submitting,
  showShortcutHint,
  shortcutHint,
  sendShortcuts,
  showSubmitText,
  footerLeading,
  className
}: ChatComposerProps): React.JSX.Element {
  return (
    <ConversationInput
      onSubmit={onSubmit}
      ariaLabel={ariaLabel}
      placeholder={placeholder}
      submitLabel={submitLabel}
      disabled={disabled}
      submitting={submitting}
      showShortcutHint={showShortcutHint}
      shortcutHint={shortcutHint}
      sendShortcuts={sendShortcuts}
      showSubmitText={showSubmitText}
      footerLeading={footerLeading}
      className={className}
    />
  )
}

export default ChatComposer
