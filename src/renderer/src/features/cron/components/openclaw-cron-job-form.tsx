import { Input } from '@/shared/ui/input'
import { Select, type SelectOption } from '@/shared/ui/select'
import { Switch } from '@/shared/ui/switch'
import { Textarea } from '@/shared/ui/textarea'
import { cn } from '@/shared/lib/utils'
import { useAppI18n } from '@/shared/i18n/app-i18n'
import {
  OPENCLAW_CRON_DEFAULT_CRON_EXPRESSION,
  OPENCLAW_CRON_DEFAULT_DELIVERY_CHANNEL,
  OPENCLAW_CRON_DEFAULT_EVERY_INTERVAL
} from '@/features/cron/lib/openclaw-cron-constants'
import type { OpenClawCronFormValues } from '@/features/cron/lib/openclaw-cron-types'

type OpenClawCronJobFormProps = {
  values: OpenClawCronFormValues
  onChange: <K extends keyof OpenClawCronFormValues>(
    field: K,
    value: OpenClawCronFormValues[K]
  ) => void
}

type FieldProps = {
  htmlFor?: string
  label: string
  children: React.ReactNode
}

function Field({ htmlFor, label, children }: FieldProps): React.JSX.Element {
  return (
    <section className="flex flex-col gap-2">
      <label className="text-sm font-medium text-foreground" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
    </section>
  )
}

function OpenClawCronJobForm({ values, onChange }: OpenClawCronJobFormProps): React.JSX.Element {
  const { t } = useAppI18n()
  const sessionTargetOptions: SelectOption[] = [
    {
      value: 'isolated',
      label: t('cron.form.option.sessionTarget.isolated')
    },
    {
      value: 'main',
      label: t('cron.form.option.sessionTarget.main')
    }
  ]
  const wakeModeOptions: SelectOption[] = [
    {
      value: 'now',
      label: t('cron.form.option.wakeMode.now')
    },
    {
      value: 'next-heartbeat',
      label: t('cron.form.option.wakeMode.nextHeartbeat')
    }
  ]
  const scheduleKindOptions: SelectOption[] = [
    {
      value: 'at',
      label: t('cron.form.option.scheduleKind.at')
    },
    {
      value: 'every',
      label: t('cron.form.option.scheduleKind.every')
    },
    {
      value: 'cron',
      label: t('cron.form.option.scheduleKind.cron')
    }
  ]
  const deliveryModeOptions: SelectOption[] = [
    {
      value: 'announce',
      label: t('cron.form.option.deliveryMode.announce')
    },
    {
      value: 'none',
      label: t('cron.form.option.deliveryMode.none')
    }
  ]

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_180px]">
        <Field htmlFor="openclaw-cron-name" label={t('cron.form.label.name')}>
          <Input
            id="openclaw-cron-name"
            density="sm"
            value={values.name}
            onChange={(event) => onChange('name', event.target.value)}
            placeholder={t('cron.form.placeholder.name')}
            required
          />
        </Field>

        <section className="flex flex-col gap-2">
          <span className="text-sm font-medium text-foreground">{t('cron.form.label.status')}</span>
          <div className="flex h-9 items-center justify-between rounded-[0.75rem] border border-black/8 bg-background px-3 text-sm text-foreground">
            <span>{t('cron.form.label.enabled')}</span>
            <Switch
              aria-label={t('cron.form.aria.enabled')}
              checked={values.enabled}
              onCheckedChange={(checked) => onChange('enabled', checked)}
            />
          </div>
        </section>
      </div>

      {values.sessionTarget === 'isolated' && values.deliveryMode === 'announce' ? (
        <Field htmlFor="openclaw-cron-delivery-channel" label={t('cron.form.label.deliveryChannel')}>
          <Input
            id="openclaw-cron-delivery-channel"
            density="sm"
            value={values.deliveryChannel}
            onChange={(event) => onChange('deliveryChannel', event.target.value)}
            placeholder={OPENCLAW_CRON_DEFAULT_DELIVERY_CHANNEL}
          />
        </Field>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <Field label={t('cron.form.label.sessionTarget')}>
          <Select
            ariaLabel={t('cron.form.aria.sessionTarget')}
            options={sessionTargetOptions}
            value={values.sessionTarget}
            onValueChange={(value) =>
              onChange('sessionTarget', value as OpenClawCronFormValues['sessionTarget'])
            }
          />
        </Field>

        <Field label={t('cron.form.label.wakeMode')}>
          <Select
            ariaLabel={t('cron.form.aria.wakeMode')}
            options={wakeModeOptions}
            value={values.wakeMode}
            onValueChange={(value) =>
              onChange('wakeMode', value as OpenClawCronFormValues['wakeMode'])
            }
          />
        </Field>
      </div>

      <section className="flex flex-col gap-3">
        <div
          className={cn(
            'grid gap-4',
            values.sessionTarget === 'isolated'
              ? 'md:grid-cols-2'
              : 'md:grid-cols-[minmax(0,260px)]'
          )}
        >
          <Field label={t('cron.form.label.scheduleKind')}>
            <Select
              ariaLabel={t('cron.form.aria.scheduleKind')}
              options={scheduleKindOptions}
              value={values.scheduleKind}
              onValueChange={(value) =>
                onChange('scheduleKind', value as OpenClawCronFormValues['scheduleKind'])
              }
            />
          </Field>

          {values.sessionTarget === 'isolated' ? (
            <Field label={t('cron.form.label.deliveryMode')}>
              <Select
                ariaLabel={t('cron.form.aria.deliveryMode')}
                options={deliveryModeOptions}
                value={values.deliveryMode}
                onValueChange={(value) =>
                  onChange('deliveryMode', value as OpenClawCronFormValues['deliveryMode'])
                }
              />
            </Field>
          ) : null}
        </div>

        {values.scheduleKind === 'at' ? (
          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_180px]">
            <Field htmlFor="openclaw-cron-at" label={t('cron.form.label.atDateTime')}>
              <Input
                id="openclaw-cron-at"
                density="sm"
                type="datetime-local"
                value={values.atDateTime}
                onChange={(event) => onChange('atDateTime', event.target.value)}
              />
            </Field>

            <section className="flex flex-col gap-2">
              <span className="text-sm font-medium text-foreground">{t('cron.form.label.oneTime')}</span>
              <div className="flex h-9 items-center justify-between rounded-[0.75rem] border border-black/8 bg-background px-3 text-sm text-foreground">
                <span>{t('cron.form.label.deleteAfterRun')}</span>
                <Switch
                  aria-label={t('cron.form.aria.deleteAfterRun')}
                  checked={values.deleteAfterRun}
                  onCheckedChange={(checked) => onChange('deleteAfterRun', checked)}
                />
              </div>
            </section>
          </div>
        ) : null}

        {values.scheduleKind === 'every' ? (
          <Field htmlFor="openclaw-cron-every" label={t('cron.form.label.everyInterval')}>
            <Input
              id="openclaw-cron-every"
              density="sm"
              value={values.everyInterval}
              onChange={(event) => onChange('everyInterval', event.target.value)}
              placeholder={t('cron.form.placeholder.everyInterval', {
                defaultInterval: OPENCLAW_CRON_DEFAULT_EVERY_INTERVAL
              })}
            />
          </Field>
        ) : null}

        {values.scheduleKind === 'cron' ? (
          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_220px]">
            <Field htmlFor="openclaw-cron-expr" label={t('cron.form.label.cronExpr')}>
              <Input
                id="openclaw-cron-expr"
                density="sm"
                value={values.cronExpr}
                onChange={(event) => onChange('cronExpr', event.target.value)}
                placeholder={OPENCLAW_CRON_DEFAULT_CRON_EXPRESSION}
              />
            </Field>

            <Field htmlFor="openclaw-cron-tz" label={t('cron.form.label.timezone')}>
              <Input
                id="openclaw-cron-tz"
                density="sm"
                value={values.cronTz}
                onChange={(event) => onChange('cronTz', event.target.value)}
                placeholder={t('cron.form.placeholder.timezone')}
              />
            </Field>
          </div>
        ) : null}
      </section>

      <Field
        htmlFor={
          values.sessionTarget === 'main'
            ? 'openclaw-cron-system-event'
            : 'openclaw-cron-agent-message'
        }
        label={
          values.sessionTarget === 'main'
            ? t('cron.form.label.systemEventText')
            : t('cron.form.label.agentMessage')
        }
      >
        <Textarea
          id={
            values.sessionTarget === 'main'
              ? 'openclaw-cron-system-event'
              : 'openclaw-cron-agent-message'
          }
          density="sm"
          value={values.sessionTarget === 'main' ? values.systemEventText : values.agentMessage}
          onChange={(event) =>
            onChange(
              values.sessionTarget === 'main' ? 'systemEventText' : 'agentMessage',
              event.target.value
            )
          }
          placeholder={
            values.sessionTarget === 'main'
              ? t('cron.form.placeholder.systemEventText')
              : t('cron.form.placeholder.agentMessage')
          }
        />
      </Field>
    </div>
  )
}

export default OpenClawCronJobForm
