export type ConversationMessageStatus = 'sending' | 'sent' | 'streaming' | 'error'

export type ConversationUserTagType = 'image' | 'attachment' | 'text'

export type ConversationUserTag = {
  type: ConversationUserTagType
  label: string
  previewSrc?: string
  relativePath?: string
  absolutePath?: string
}

export type ConversationMessage = {
  id: string
  role: 'assistant' | 'user'
  content: string
  timeLabel: string
  status?: ConversationMessageStatus
  runId?: string
  tags?: ConversationUserTag[]
}

export type ConversationAvatar = {
  label: string
  emoji?: string
  imageSrc?: string
}
