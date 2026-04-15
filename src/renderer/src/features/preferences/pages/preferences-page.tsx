import { useMemo, type ReactNode } from 'react'

import {
  APP_LANGUAGE_VALUES,
  normalizeAppLanguage,
  normalizeSendKey
} from '@/features/preferences/lib/app-preferences'
import { useAppStore } from '@/features/instances/store/use-app-store'
import SendKeyCaptureInput from '@/features/preferences/components/send-key-capture-input'
import AppShellContentArea from '@/shared/layout/app-shell-content-area'
import { useAppI18n } from '@/shared/i18n/app-i18n'
import { cn } from '@/shared/lib/utils'
import { Select, type SelectOption } from '@/shared/ui/select'

type PreferencesRowProps = {
  title: string
  description: string
  control: ReactNode
  className?: string
}

function PreferencesRow({ title, description, control, className }: PreferencesRowProps): React.JSX.Element {
  return (
    <div
      className={cn(
        'grid grid-cols-[minmax(0,1fr)_auto] items-center justify-between gap-5 p-2 max-[960px]:grid-cols-1 max-[960px]:items-start max-[960px]:gap-3',
        className
      )}
    >
      <div className="min-w-0">
        <h2 className="text-[14px] font-semibold leading-6 text-foreground">{title}</h2>
        <p className="mt-1 text-[14px] leading-6 text-muted-foreground">{description}</p>
      </div>
      <div className="justify-self-end max-[960px]:justify-self-start">{control}</div>
    </div>
  )
}

function PreferencesPage(): React.JSX.Element {
  const { t } = useAppI18n()
  const language = useAppStore((state) => normalizeAppLanguage(state.preferences.language))
  const sendKey = useAppStore((state) => normalizeSendKey(state.preferences.sendKey))
  const setPreferencesLanguage = useAppStore((state) => state.setPreferencesLanguage)
  const setPreferencesSendKey = useAppStore((state) => state.setPreferencesSendKey)

  const languageOptions = useMemo<SelectOption[]>(
    () =>
      APP_LANGUAGE_VALUES.map((value) => ({
        value,
        label: t(`preferences.language.option.${value}`)
      })),
    [t]
  )

  return (
    <AppShellContentArea
      showHeaderWithoutConnectedInstance
      disableInnerPadding
      headerClassName="h-[92px] items-end border-b-0 px-24 pb-4"
      header={
        <h1 className="text-[22px] font-semibold tracking-tight text-foreground">
          {t('preferences.page.title')}
        </h1>
      }
    >
      <section className="px-24 pb-8">
        <div className="overflow-hidden rounded-[0.5rem] border border-black/8 bg-white">
          <PreferencesRow
            title={t('preferences.language.label')}
            description={t('preferences.language.description')}
            control={
              <Select
                value={language}
                options={languageOptions}
                ariaLabel={t('preferences.language.label')}
                triggerClassName="h-9 w-48 rounded-[0.5rem] border-none bg-[#F3F4F7] shadow-none hover:bg-[#ECEFF4]"
                onValueChange={(value) => {
                  setPreferencesLanguage(normalizeAppLanguage(value))
                }}
              />
            }
          />

          <PreferencesRow
            className="border-t border-black/6"
            title={t('preferences.sendKey.label')}
            description={t('preferences.sendKey.description')}
            control={
              <SendKeyCaptureInput
                value={sendKey}
                onValueChange={(value) => {
                  setPreferencesSendKey(value)
                }}
              />
            }
          />
        </div>
      </section>
    </AppShellContentArea>
  )
}

export default PreferencesPage
