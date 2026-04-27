import type { ReactNode } from 'react'

import ConversationInput from '@/features/chat/components/conversation-input'
import type { ChatSubmitPayload } from '@/features/chat/lib/chat-send-types'

type ChatComposerProps = {
  onSubmit: (payload: ChatSubmitPayload) => Promise<void> | void
  onStop?: () => Promise<void> | void
  ariaLabel?: string
  placeholder?: string
  submitLabel?: string
  disabled?: boolean
  submitting?: boolean
  stopVisible?: boolean
  stopping?: boolean
  showShortcutHint?: boolean
  shortcutHint?: string
  sendShortcuts?: string[]
  slashMenuTrigger?: string
  skillMenuTrigger?: string
  customSkillNames?: string[]
  onRequestCustomSkillNames?: () => Promise<string[]>
  showSubmitText?: boolean
  footerLeading?: ReactNode
  className?: string
}

function ChatComposer({
  onSubmit,
  onStop,
  ariaLabel,
  placeholder,
  submitLabel,
  disabled,
  submitting,
  stopVisible,
  stopping,
  showShortcutHint,
  shortcutHint,
  sendShortcuts,
  slashMenuTrigger,
  skillMenuTrigger,
  customSkillNames,
  onRequestCustomSkillNames,
  showSubmitText,
  footerLeading,
  className
}: ChatComposerProps): React.JSX.Element {
  return (
    <ConversationInput
      onSubmit={onSubmit}
      onStop={onStop}
      ariaLabel={ariaLabel}
      placeholder={placeholder}
      submitLabel={submitLabel}
      disabled={disabled}
      submitting={submitting}
      stopVisible={stopVisible}
      stopping={stopping}
      showShortcutHint={showShortcutHint}
      shortcutHint={shortcutHint}
      sendShortcuts={sendShortcuts}
      slashMenuTrigger={slashMenuTrigger}
      skillMenuTrigger={skillMenuTrigger}
      customSkillNames={customSkillNames}
      onRequestCustomSkillNames={onRequestCustomSkillNames}
      showSubmitText={showSubmitText}
      footerLeading={footerLeading}
      className={className}
    />
  )
}

export default ChatComposer
