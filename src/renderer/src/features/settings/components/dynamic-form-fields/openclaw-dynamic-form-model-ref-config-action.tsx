import { useMemo, useState } from 'react'
import type { FieldValues } from 'react-hook-form'

import OpenClawInstanceModelRefDialog from '@/features/settings/components/openclaw-instance-model-ref-dialog'
import type { OpenClawModelRefDraft } from '@/features/settings/lib/openclaw-instance-global-config-types'
import { useAppI18n } from '@/shared/i18n/app-i18n'
import type { DynamicFormComponentProps } from '@/shared/lib/dynamic-form-engine'
import { Button } from '@/shared/ui/button'

type ModelRefFieldProps = {
  dialogTitle?: string
  modelOptions?: string[]
}

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

function OpenClawDynamicFormModelRefConfigAction<TValues extends FieldValues = FieldValues>({
  value,
  onChange,
  disabled,
  field
}: DynamicFormComponentProps<TValues>): React.JSX.Element {
  const { t } = useAppI18n()
  const [open, setOpen] = useState(false)
  const modelRefDraft = useMemo(() => toModelRefDraft(value), [value])
  const options = (field.props ?? {}) as ModelRefFieldProps
  const modelOptions = options.modelOptions ?? []
  const dialogTitle = options.dialogTitle ?? t('settings.modelRefAction.dialogTitle', {
    label: field.metadata.label
  })

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        disabled={disabled}
        className="h-8 rounded-[0.7rem] px-1.5 text-xs text-sky-600 hover:bg-sky-50 hover:text-sky-700"
        onClick={() => {
          setOpen(true)
        }}
      >
        {t('settings.modelRefAction.configure')}
      </Button>

      <OpenClawInstanceModelRefDialog
        open={open}
        title={dialogTitle}
        modelOptions={modelOptions}
        initialValue={
          modelRefDraft
            ? {
                primary: modelRefDraft.primary,
                fallbacks: modelRefDraft.fallbacks
              }
            : undefined
        }
        onClose={() => {
          setOpen(false)
        }}
        onSubmit={(payload) => {
          const nextPrimary = payload.primary.trim()
          const nextFallbacks = payload.fallbacks
            .map((entry) => entry.trim())
            .filter((entry) => entry.length > 0)

          onChange(
            nextPrimary || nextFallbacks.length > 0
              ? {
                  primary: nextPrimary,
                  fallbacks: nextFallbacks
                }
              : null
          )
          setOpen(false)
        }}
      />
    </>
  )
}

export default OpenClawDynamicFormModelRefConfigAction
