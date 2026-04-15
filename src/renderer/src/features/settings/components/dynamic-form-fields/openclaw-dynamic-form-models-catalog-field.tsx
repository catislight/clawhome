import { Pencil, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { FieldValues } from 'react-hook-form'

import OpenClawInstanceModelEntryDialog from '@/features/settings/components/openclaw-instance-model-entry-dialog'
import {
  deleteModelsCatalogEntry,
  formatModelEntryParams,
  upsertModelsCatalogEntry
} from '@/features/settings/lib/openclaw-instance-global-config-draft'
import type { OpenClawModelEntryDraft } from '@/features/settings/lib/openclaw-instance-global-config-types'
import { useAppI18n } from '@/shared/i18n/app-i18n'
import type { DynamicFormComponentProps } from '@/shared/lib/dynamic-form-engine'
import { Button } from '@/shared/ui/button'

type ModelEntryDialogState = {
  mode: 'edit'
  ref?: string
}

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

function OpenClawDynamicFormModelsCatalogField<TValues extends FieldValues = FieldValues>({
  value,
  onChange,
  disabled
}: DynamicFormComponentProps<TValues>): React.JSX.Element {
  const { t } = useAppI18n()
  const [entryDialogState, setEntryDialogState] = useState<ModelEntryDialogState | null>(null)
  const [panelError, setPanelError] = useState<string | null>(null)

  const catalog = useMemo(() => toModelsCatalog(value), [value])
  const sortedModelRefs = useMemo(() => Object.keys(catalog).sort((a, b) => a.localeCompare(b)), [catalog])

  const entryDialogInitialValue = useMemo(() => {
    if (!entryDialogState || entryDialogState.mode !== 'edit' || !entryDialogState.ref) {
      return undefined
    }

    const target = catalog[entryDialogState.ref]
    if (!target) {
      return undefined
    }

    return {
      ref: entryDialogState.ref,
      alias: target.alias ?? '',
      paramsText: formatModelEntryParams(target.params)
    }
  }, [catalog, entryDialogState])

  return (
    <div className="space-y-2 rounded-[0.8rem] border border-black/8 bg-[#F3F4F8] px-3 py-3">
      {panelError ? (
        <p className="rounded-[0.6rem] border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
          {panelError}
        </p>
      ) : null}

      {sortedModelRefs.length === 0 ? (
        <p className="rounded-[0.65rem] border border-black/8 bg-card px-3 py-2 text-xs text-muted-foreground">
          {t('settings.modelsCatalog.empty')}
        </p>
      ) : (
        <div className="space-y-2">
          {sortedModelRefs.map((ref) => {
            const entry = catalog[ref]
            return (
              <div
                key={ref}
                className="flex items-start justify-between gap-3 rounded-[0.65rem] border border-black/8 bg-card px-3 py-2.5"
              >
                <div className="min-w-0">
                  <p className="truncate text-base font-semibold text-foreground">{ref}</p>
                  <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                    {t('settings.modelsCatalog.alias', {
                      value: entry?.alias?.trim() ? entry.alias : t('settings.common.unset')
                    })}
                  </p>
                  <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                    {t('settings.modelsCatalog.params', {
                      value: entry?.params
                        ? t('settings.modelsCatalog.params.configured')
                        : t('settings.common.unset')
                    })}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-1.5">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={disabled}
                    className="h-7 rounded-[0.7rem] px-2 text-[11px]"
                    onClick={() => {
                      setPanelError(null)
                      setEntryDialogState({ mode: 'edit', ref })
                    }}
                  >
                    <Pencil className="size-3" />
                    {t('settings.common.edit')}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={disabled}
                    className="h-7 rounded-[0.7rem] border-rose-200 px-2 text-[11px] text-rose-700 hover:bg-rose-50"
                    onClick={() => {
                      onChange(
                        deleteModelsCatalogEntry({
                          models: catalog,
                          ref
                        })
                      )
                    }}
                  >
                    <Trash2 className="size-3" />
                    {t('settings.common.delete')}
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <OpenClawInstanceModelEntryDialog
        open={entryDialogState !== null}
        mode={entryDialogState?.mode ?? 'edit'}
        initialValue={entryDialogInitialValue}
        errorMessage={panelError}
        onClose={() => {
          setEntryDialogState(null)
          setPanelError(null)
        }}
        onSubmit={(payload) => {
          try {
            const nextCatalog = upsertModelsCatalogEntry({
              models: catalog,
              ref: payload.ref,
              alias: payload.alias,
              paramsText: payload.paramsText
            })
            onChange(nextCatalog)
            setPanelError(null)
            setEntryDialogState(null)
          } catch (error) {
            setPanelError(
              error instanceof Error ? error.message : t('settings.error.saveModelEntryFailed')
            )
          }
        }}
      />
    </div>
  )
}

export default OpenClawDynamicFormModelsCatalogField
