import { useCallback, useMemo, type ReactNode } from 'react'

import SlashInput from '@/features/chat/components/editor/SlashInput'
import type { SlashInputContent } from '@/features/chat/components/editor/extensions/send-content/SendContent.utils'
import type { ChatSubmitPayload } from '@/features/chat/lib/chat-send-types'
import { OPENCLAW_SLASH_MENU_ITEMS } from '@/features/chat/lib/openclaw-slash-menu-items'
import { useAppI18n } from '@/shared/i18n/app-i18n'

type ConversationInputProps = {
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

type ConversationInputCopy = {
  imageAttachmentLabel: string
  textAttachmentLabel: string
  filePrefix: string
  attachmentLabel: string
  attachmentPrefix: string
}

const DEFAULT_SEND_SHORTCUT = 'Mod-Enter'
const SEND_SHORTCUT_DELIMITER = '\u0001'

function composeSubmitPayload(
  content: SlashInputContent,
  copy: ConversationInputCopy
): ChatSubmitPayload | null {
  const tags: ChatSubmitPayload['tags'] = []
  const images = content.images
    .map((image) => ({
      src: image.src,
      fileName: image.fileName?.trim() || undefined,
      relativePath: image.relativePath?.trim() || undefined,
      absolutePath: image.absolutePath?.trim() || undefined
    }))
    .filter((image) => image.src.trim().length > 0 || (image.absolutePath && image.relativePath))
  images.forEach((image) => {
    tags.push({
      type: 'image',
      label: image.fileName || copy.imageAttachmentLabel,
      previewSrc: image.src,
      relativePath: image.relativePath,
      absolutePath: image.absolutePath
    })
  })

  const parts: string[] = []
  const normalizedText = content.text.trim()
  if (normalizedText) {
    parts.push(normalizedText)
  }

  content.tags.forEach((tag) => {
    if (!tag.content?.trim()) {
      return
    }
    const title = tag.label?.trim() || copy.textAttachmentLabel
    tags.push({
      type: 'text',
      label: title
    })
    parts.push(`${copy.filePrefix} ${title}：\n\`\`\`\n${tag.content}\n\`\`\``)
  })

  content.attachments.forEach((attachment) => {
    const fileName = attachment.fileName?.trim() || copy.attachmentLabel
    tags.push({
      type: 'attachment',
      label: fileName
    })
    parts.push(`[${copy.attachmentPrefix}] ${fileName}`)
  })

  const message = parts.join('\n\n').trim()
  if (!message && images.length === 0) {
    return null
  }

  return {
    message,
    images,
    tags
  }
}

function ConversationInput(props: ConversationInputProps): React.JSX.Element {
  const { t } = useAppI18n()
  const {
    onSubmit: onSubmitValue,
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
  } = props

  const sendShortcutsSignature = (
    sendShortcuts && sendShortcuts.length > 0 ? sendShortcuts : [DEFAULT_SEND_SHORTCUT]
  )
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
    .join(SEND_SHORTCUT_DELIMITER)
  const resolvedSendShortcuts = useMemo(() => {
    const normalized = sendShortcutsSignature
      .split(SEND_SHORTCUT_DELIMITER)
      .map((item) => item.trim())
      .filter((item) => item.length > 0)
    return normalized.length > 0 ? normalized : [DEFAULT_SEND_SHORTCUT]
  }, [sendShortcutsSignature])

  const copy: ConversationInputCopy = {
    imageAttachmentLabel: t('chat.conversationInput.imageAttachment'),
    textAttachmentLabel: t('chat.conversationInput.textAttachment'),
    filePrefix: t('chat.conversationInput.filePrefix'),
    attachmentLabel: t('chat.conversationInput.genericAttachment'),
    attachmentPrefix: t('chat.conversationInput.attachmentPrefix')
  }

  const handleSend = useCallback(
    (content: SlashInputContent) => {
      const payload = composeSubmitPayload(content, copy)
      if (!payload) {
        return
      }

      void Promise.resolve(onSubmitValue(payload))
    },
    [copy, onSubmitValue]
  )

  return (
    <SlashInput
      className={className}
      slashItems={OPENCLAW_SLASH_MENU_ITEMS}
      placeholder={placeholder}
      ariaLabel={ariaLabel}
      submitLabel={submitLabel}
      disabled={disabled}
      submitting={submitting}
      showShortcutHint={showShortcutHint}
      shortcutHint={shortcutHint}
      showSubmitText={showSubmitText}
      footerLeading={footerLeading}
      sendShortcuts={resolvedSendShortcuts}
      onSend={handleSend}
    />
  )
}

export default ConversationInput
