import type { FieldValues } from 'react-hook-form'

import { useAppI18n } from '@/shared/i18n/app-i18n'
import type { DynamicFormComponentProps } from '@/shared/lib/dynamic-form-engine'
import { toUniqueTrimmedStrings } from '@/shared/lib/string-array'

type AllowAgentsFieldProps = {
  options?: string[]
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value.map((entry) => String(entry))
}

function OpenClawDynamicFormAllowAgentsField<TValues extends FieldValues = FieldValues>({
  value,
  onChange,
  disabled,
  field
}: DynamicFormComponentProps<TValues>): React.JSX.Element {
  const { t } = useAppI18n()
  const currentValues = toStringArray(value)
  const options = ((field.props ?? {}) as AllowAgentsFieldProps).options ?? []

  const updateChecked = (agentId: string, checked: boolean): void => {
    const nextValues = checked
      ? toUniqueTrimmedStrings([...currentValues, agentId])
      : currentValues.filter((entry) => entry !== agentId)

    onChange(nextValues)
  }

  return (
    <div className="max-h-[180px] overflow-y-auto rounded-[0.75rem] border border-black/8 bg-background px-2 py-2">
      <div className="space-y-1">
        <label className="flex items-center gap-2 rounded-[0.55rem] px-2 py-1.5 text-xs text-foreground hover:bg-black/4">
          <input
            type="checkbox"
            checked={currentValues.includes('*')}
            disabled={disabled}
            onChange={(event) => {
              updateChecked('*', event.target.checked)
            }}
          />
          <span>{t('agents.form.allowAgents.any')}</span>
        </label>

        {options.map((agentId) => (
          <label
            key={agentId}
            className="flex items-center gap-2 rounded-[0.55rem] px-2 py-1.5 text-xs text-foreground hover:bg-black/4"
          >
            <input
              type="checkbox"
              checked={currentValues.includes(agentId)}
              disabled={disabled}
              onChange={(event) => {
                updateChecked(agentId, event.target.checked)
              }}
            />
            <span>{agentId}</span>
          </label>
        ))}
      </div>
    </div>
  )
}

export default OpenClawDynamicFormAllowAgentsField
