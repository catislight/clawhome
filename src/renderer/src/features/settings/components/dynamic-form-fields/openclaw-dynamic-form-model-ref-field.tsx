import { useMemo } from 'react'
import type { FieldValues } from 'react-hook-form'

import type { OpenClawModelRefDraft } from '@/features/settings/lib/openclaw-instance-global-config-types'
import { useAppI18n } from '@/shared/i18n/app-i18n'
import type { DynamicFormComponentProps } from '@/shared/lib/dynamic-form-engine'
import { Button } from '@/shared/ui/button'

function toModelRefDraft(value: unknown): OpenClawModelRefDraft | null {
  if (!value || typeof value !== 'object') {
    return null
  }

  const rawValue = value as Record<string, unknown>
  const primary = typeof rawValue.primary === 'string' ? rawValue.primary : ''
  const fallbacks = Array.isArray(rawValue.fallbacks)
    ? rawValue.fallbacks.map((entry) => String(entry).trim()).filter(Boolean)
    : []

  if (!primary.trim() && fallbacks.length === 0) {
    return null
  }

  return { primary, fallbacks }
}

function renderModelRefSummary(
  modelRef: OpenClawModelRefDraft | null,
  t: ReturnType<typeof useAppI18n>['t']
): string {
  if (!modelRef) {
    return t('settings.modelRef.summary.unset')
  }

  const primary = modelRef.primary.trim() || t('settings.modelRef.summary.primaryUnset')
  if (modelRef.fallbacks.length === 0) {
    return t('settings.modelRef.summary.noFallbacks', { primary })
  }

  return t('settings.modelRef.summary.withFallbacks', {
    primary,
    count: modelRef.fallbacks.length
  })
}

function OpenClawDynamicFormModelRefField<TValues extends FieldValues = FieldValues>({
  value,
  onChange,
  disabled
}: DynamicFormComponentProps<TValues>): React.JSX.Element {
  const { t } = useAppI18n()
  const modelRefDraft = useMemo(() => toModelRefDraft(value), [value])

  return (
    <section className="space-y-2 rounded-[0.8rem] border border-black/8 bg-background px-3 py-3">
      <p className="text-xs text-muted-foreground">{renderModelRefSummary(modelRefDraft, t)}</p>

      {modelRefDraft ? (
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={disabled}
            className="h-8 rounded-[0.7rem] px-2.5 text-xs"
            onClick={() => {
              onChange(null)
            }}
          >
            {t('settings.modelRef.clear')}
          </Button>
        </div>
      ) : null}
    </section>
  )
}

export default OpenClawDynamicFormModelRefField
