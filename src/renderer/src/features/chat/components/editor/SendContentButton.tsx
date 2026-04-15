import type { ButtonProps } from '@/shared/ui/button'
import { Button } from '@/shared/ui/button'
import type { Editor } from '@tiptap/core'
import { ArrowUp, Loader2 } from 'lucide-react'
import { useCallback, type MouseEvent } from 'react'
import { useAppI18n } from '@/shared/i18n/app-i18n'

interface SendContentButtonProps extends ButtonProps {
  editor: Editor | null
  label?: string
  submitting?: boolean
  showLabel?: boolean
}

const SendContentButton = ({
  editor,
  label,
  disabled,
  submitting = false,
  showLabel = true,
  onClick,
  ...rest
}: SendContentButtonProps): React.JSX.Element => {
  const { t } = useAppI18n()
  const resolvedLabel = label ?? t('chat.sendButton.defaultLabel')

  const handleClick = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      if (!editor) {
        return
      }
      editor.commands.sendContent()
      onClick?.(event)
    },
    [editor, onClick]
  )

  return (
    <Button {...rest} onClick={handleClick} disabled={disabled || !editor}>
      {submitting ? <Loader2 className="size-3 animate-spin" /> : <ArrowUp className="size-3" />}
      {showLabel ? resolvedLabel : null}
    </Button>
  )
}

export default SendContentButton
