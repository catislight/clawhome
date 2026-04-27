import { useEffect, useMemo, useState } from 'react'

import {
  buildMenuTriggerFromKeyboardEvent,
  normalizeMenuTrigger
} from '@/features/preferences/lib/app-preferences'
import { useAppI18n } from '@/shared/i18n/app-i18n'
import { cn } from '@/shared/lib/utils'
import { Button } from '@/shared/ui/button'

type MenuTriggerCaptureInputProps = {
  value: string
  defaultValue: string
  label: string
  onValueChange: (value: string) => void
  className?: string
}

function MenuTriggerCaptureInput({
  value,
  defaultValue,
  label,
  onValueChange,
  className
}: MenuTriggerCaptureInputProps): React.JSX.Element {
  const { t } = useAppI18n()
  const [listening, setListening] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const displayValue = useMemo(
    () => normalizeMenuTrigger(value, defaultValue),
    [defaultValue, value]
  )
  const listeningLabel = t('preferences.chatMenuTrigger.listening')

  useEffect(() => {
    if (!listening) {
      return
    }

    const handleKeydown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        setListening(false)
        setError(null)
        return
      }

      const captured = buildMenuTriggerFromKeyboardEvent(event)

      event.preventDefault()
      event.stopPropagation()

      if (!captured) {
        setError(t('preferences.chatMenuTrigger.invalid'))
        return
      }

      onValueChange(normalizeMenuTrigger(captured, defaultValue))
      setError(null)
      setListening(false)
    }

    window.addEventListener('keydown', handleKeydown, true)

    return () => {
      window.removeEventListener('keydown', handleKeydown, true)
    }
  }, [defaultValue, listening, onValueChange, t])

  return (
    <div className={cn('flex flex-col items-end gap-1.5', className)}>
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label={label}
          className={cn(
            'inline-flex min-w-[6rem] items-center justify-center rounded-[0.5rem] border border-black/8 bg-[#F6F7F9] px-2 py-1.5 text-[14px] font-medium text-foreground transition-colors hover:border-black/12 hover:bg-[#EFF1F5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70 focus-visible:ring-offset-2 focus-visible:ring-offset-background',
            listening && 'border-primary/20 bg-primary/8 text-primary'
          )}
          onClick={() => {
            setListening((current) => !current)
            setError(null)
          }}
        >
          {listening ? listeningLabel : displayValue}
        </button>

        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-8 rounded-[0.6rem] px-2.5 text-[14px]"
          onClick={() => {
            onValueChange(defaultValue)
            setError(null)
            setListening(false)
          }}
        >
          {t('preferences.chatMenuTrigger.clear')}
        </Button>
      </div>

      {error ? <p className="text-[14px] text-rose-600">{error}</p> : null}
    </div>
  )
}

export default MenuTriggerCaptureInput
