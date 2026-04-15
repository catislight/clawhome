import { useEffect, useMemo, useState } from 'react'

import type { ModelRefDialogPayload } from '@/features/settings/lib/openclaw-instance-global-config-types'
import { multilineToValues, valuesToMultiline } from '@/features/settings/lib/openclaw-instance-global-config-draft'
import { useAppI18n } from '@/shared/i18n/app-i18n'
import { Button } from '@/shared/ui/button'
import DialogShell from '@/shared/ui/dialog-shell'
import { Input } from '@/shared/ui/input'
import { Textarea } from '@/shared/ui/textarea'

type OpenClawInstanceModelRefDialogProps = {
  open: boolean
  title: string
  modelOptions: string[]
  initialValue?: ModelRefDialogPayload
  onClose: () => void
  onSubmit: (payload: ModelRefDialogPayload) => void
}

function OpenClawInstanceModelRefDialog({
  open,
  title,
  modelOptions,
  initialValue,
  onClose,
  onSubmit
}: OpenClawInstanceModelRefDialogProps): React.JSX.Element | null {
  const { t } = useAppI18n()
  const [primary, setPrimary] = useState('')
  const [fallbacksText, setFallbacksText] = useState('')

  useEffect(() => {
    if (!open) {
      return
    }

    setPrimary(initialValue?.primary ?? '')
    setFallbacksText(valuesToMultiline(initialValue?.fallbacks ?? []))
  }, [initialValue, open])

  const fallbackValues = useMemo(() => multilineToValues(fallbacksText), [fallbacksText])

  if (!open) {
    return null
  }

  return (
    <DialogShell
      title={title}
      maxWidthClassName="max-w-[calc(100vw-1rem)] sm:max-w-[42rem]"
      onClose={onClose}
    >
      <div className="space-y-3">
        <label className="space-y-1.5 text-xs text-muted-foreground">
          <span className="font-medium text-muted-foreground">{t('settings.modelRefDialog.field.primary')}</span>
          <Input
            density="sm"
            value={primary}
            list="instance-model-options"
            placeholder={t('settings.modelRefDialog.placeholder.primary')}
            onChange={(event) => {
              setPrimary(event.target.value)
            }}
          />
          <datalist id="instance-model-options">
            {modelOptions.map((model) => (
              <option key={model} value={model} />
            ))}
          </datalist>
        </label>

        <label className="space-y-1.5 text-xs text-muted-foreground">
          <span className="font-medium text-muted-foreground">{t('settings.modelRefDialog.field.fallbacks')}</span>
          <Textarea
            density="sm"
            value={fallbacksText}
            className="min-h-28 font-mono text-xs"
            placeholder={t('settings.modelRefDialog.placeholder.fallbacks')}
            onChange={(event) => {
              setFallbacksText(event.target.value)
            }}
          />
        </label>

        {modelOptions.length > 0 ? (
          <div className="space-y-1.5 rounded-[0.75rem] border border-black/8 bg-background px-3 py-2.5">
            <p className="text-xs font-medium text-muted-foreground">{t('settings.modelRefDialog.quickSelect')}</p>
            <div className="max-h-36 overflow-y-auto">
              <div className="grid gap-1.5 sm:grid-cols-2">
                {modelOptions.map((model) => {
                  const checked = fallbackValues.includes(model)

                  return (
                    <label
                      key={model}
                      className="flex items-center gap-2 rounded-[0.55rem] px-2 py-1.5 text-xs text-foreground hover:bg-black/4"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(event) => {
                          const next = new Set(fallbackValues)
                          if (event.target.checked) {
                            next.add(model)
                          } else {
                            next.delete(model)
                          }
                          setFallbacksText(valuesToMultiline(Array.from(next)))
                        }}
                      />
                      <span className="truncate">{model}</span>
                    </label>
                  )
                })}
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <div className="mt-4 flex items-center justify-end gap-2 border-t border-black/6 pt-3">
        <Button
          type="button"
          variant="outline"
          className="h-8 rounded-[0.7rem] px-2.5 text-xs"
          onClick={onClose}
        >
          {t('settings.common.cancel')}
        </Button>
        <Button
          type="button"
          className="h-8 rounded-[0.7rem] px-2.5 text-xs"
          onClick={() => {
            onSubmit({
              primary,
              fallbacks: multilineToValues(fallbacksText)
            })
          }}
        >
          {t('settings.modelRefDialog.save')}
        </Button>
      </div>
    </DialogShell>
  )
}

export default OpenClawInstanceModelRefDialog
