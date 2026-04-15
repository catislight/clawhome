import { useMemo, useState } from 'react'
import type { FieldValues } from 'react-hook-form'

import OpenClawInstanceModelEntryDialog from '@/features/settings/components/openclaw-instance-model-entry-dialog'
import { upsertModelsCatalogEntry } from '@/features/settings/lib/openclaw-instance-global-config-draft'
import type { OpenClawModelEntryDraft } from '@/features/settings/lib/openclaw-instance-global-config-types'
import { useAppI18n } from '@/shared/i18n/app-i18n'
import type { DynamicFormComponentProps } from '@/shared/lib/dynamic-form-engine'
import { Button } from '@/shared/ui/button'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function toModelsCatalog(value: unknown): Record<string, OpenClawModelEntryDraft> {
  if (!isRecord(value)) {
    return {}
  }

  const next: Record<string, OpenClawModelEntryDraft> = {}
  for (const [ref, rawEntry] of Object.entries(value)) {
    const normalizedRef = ref.trim()
    if (!normalizedRef) {
      continue
    }

    if (!isRecord(rawEntry)) {
      next[normalizedRef] = {}
      continue
    }

    const alias = typeof rawEntry.alias === 'string' ? rawEntry.alias.trim() : ''
    const params = isRecord(rawEntry.params) ? rawEntry.params : undefined
    next[normalizedRef] = {
      ...(alias ? { alias } : {}),
      ...(params ? { params } : {})
    }
  }

  return next
}

function OpenClawDynamicFormModelsCatalogAddAction<TValues extends FieldValues = FieldValues>({
  value,
  onChange,
  disabled
}: DynamicFormComponentProps<TValues>): React.JSX.Element {
  const { t } = useAppI18n()
  const [open, setOpen] = useState(false)
  const [dialogError, setDialogError] = useState<string | null>(null)
  const catalog = useMemo(() => toModelsCatalog(value), [value])

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        disabled={disabled}
        className="h-8 rounded-[0.7rem] px-1.5 text-xs text-sky-600 hover:bg-sky-50 hover:text-sky-700"
        onClick={() => {
          setDialogError(null)
          setOpen(true)
        }}
      >
        {t('settings.modelsCatalog.add')}
      </Button>

      <OpenClawInstanceModelEntryDialog
        open={open}
        mode="create"
        errorMessage={dialogError}
        onClose={() => {
          setOpen(false)
          setDialogError(null)
        }}
        onSubmit={(payload) => {
          try {
            onChange(
              upsertModelsCatalogEntry({
                models: catalog,
                ref: payload.ref,
                alias: payload.alias,
                paramsText: payload.paramsText
              })
            )
            setDialogError(null)
            setOpen(false)
          } catch (error) {
            setDialogError(
              error instanceof Error ? error.message : t('settings.error.addModelEntryFailed')
            )
          }
        }}
      />
    </>
  )
}

export default OpenClawDynamicFormModelsCatalogAddAction
