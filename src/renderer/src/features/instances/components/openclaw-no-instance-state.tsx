import { ArrowRight } from 'lucide-react'

import { useAppI18n } from '@/shared/i18n/app-i18n'
import { cn } from '@/shared/lib/utils'

type OpenClawNoInstanceStateProps = {
  message: string
  onOpenConfig: () => void
  prefixLabel?: string
  actionLabel?: string
  className?: string
}

function OpenClawNoInstanceState({
  message,
  onOpenConfig,
  prefixLabel,
  actionLabel,
  className
}: OpenClawNoInstanceStateProps): React.JSX.Element {
  const { t } = useAppI18n()
  const normalizedMessage = message.trim()
  const resolvedPrefixLabel =
    prefixLabel ?? (normalizedMessage.length > 0 ? normalizedMessage : t('instances.noInstance.prefix'))
  const resolvedActionLabel = actionLabel ?? t('instances.noInstance.action')

  return (
    <section className={cn('flex min-h-0 flex-1 items-center justify-center px-6', className)}>
      <div className="-translate-y-[10%] flex items-center text-sm leading-6">
        <span className="text-muted-foreground leading-6">{resolvedPrefixLabel}</span>
        <button
          type="button"
          className="inline-flex items-center gap-1 text-primary leading-6 transition-colors hover:text-primary/80"
          onClick={onOpenConfig}
        >
          {resolvedActionLabel}
          <ArrowRight className="size-3.5" />
        </button>
      </div>
    </section>
  )
}

export default OpenClawNoInstanceState
