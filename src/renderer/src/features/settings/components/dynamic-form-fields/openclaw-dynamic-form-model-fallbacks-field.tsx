import type { FieldValues } from 'react-hook-form'

import { useAppI18n } from '@/shared/i18n/app-i18n'
import type { DynamicFormComponentProps } from '@/shared/lib/dynamic-form-engine'

type ModelFallbacksFieldProps = {
  modelOptions?: string[]
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value.map((entry) => String(entry))
}

function OpenClawDynamicFormModelFallbacksField<TValues extends FieldValues = FieldValues>({
  value,
  onChange,
  disabled,
  field
}: DynamicFormComponentProps<TValues>): React.JSX.Element {
  const { t } = useAppI18n()
  const currentValues = toStringArray(value)
  const modelOptions = ((field.props ?? {}) as ModelFallbacksFieldProps).modelOptions ?? []

  if (modelOptions.length === 0) {
    return <p className="text-xs text-muted-foreground">{t('settings.modelFallbacks.empty')}</p>
  }

  return (
    <div className="space-y-2">
      <div className="max-h-36 overflow-y-auto rounded-[0.7rem] border border-black/8 bg-background p-2">
        <div className="grid gap-1.5 sm:grid-cols-2">
          {modelOptions.map((model) => {
            const checked = currentValues.includes(model)
            return (
              <label
                key={model}
                className="flex items-center gap-2 rounded-[0.55rem] px-2 py-1.5 text-xs text-foreground hover:bg-black/4"
              >
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={disabled}
                  onChange={(event) => {
                    const next = new Set(currentValues)
                    if (event.target.checked) {
                      next.add(model)
                    } else {
                      next.delete(model)
                    }
                    onChange(modelOptions.filter((entry) => next.has(entry)))
                  }}
                />
                <span className="truncate">{model}</span>
              </label>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default OpenClawDynamicFormModelFallbacksField
