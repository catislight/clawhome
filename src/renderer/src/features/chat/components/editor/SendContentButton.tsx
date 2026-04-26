import type { ButtonProps } from '@/shared/ui/button'
import { Button } from '@/shared/ui/button'
import type { Editor } from '@tiptap/core'
import { ArrowUp, Loader2, Square } from 'lucide-react'
import { useCallback, type MouseEvent } from 'react'
import { useAppI18n } from '@/shared/i18n/app-i18n'

interface SendContentButtonProps extends ButtonProps {
  editor: Editor | null
  label?: string
  submitting?: boolean
  stopMode?: boolean
  stopping?: boolean
  showLabel?: boolean
  onStop?: () => Promise<void> | void
}

const SendContentButton = ({
  editor,
  label,
  disabled,
  submitting = false,
  stopMode = false,
  stopping = false,
  showLabel = true,
  onStop,
  onClick,
  ...rest
}: SendContentButtonProps): React.JSX.Element => {
  const { t } = useAppI18n()
  const resolvedLabel = label ?? t('chat.sendButton.defaultLabel')

  const handleClick = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      if (stopMode) {
        void onStop?.()
        onClick?.(event)
        return
      }

      if (!editor) {
        return
      }
      editor.commands.sendContent()
      onClick?.(event)
    },
    [editor, onClick, onStop, stopMode]
  )

  return (
    <Button
      {...rest}
      onClick={handleClick}
      disabled={stopMode ? disabled : disabled || !editor}
    >
      {stopMode ? (
        stopping ? (
          <Loader2 className="size-3 animate-spin" />
        ) : (
          <Square className="size-3" />
        )
      ) : submitting ? (
        <Loader2 className="size-3 animate-spin" />
      ) : (
        <ArrowUp className="size-3" />
      )}
      {showLabel ? resolvedLabel : null}
    </Button>
  )
}

export default SendContentButton
