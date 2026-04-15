import {
  ArrowRight,
  CheckCircle2,
  ChevronLeft,
  Globe,
  Laptop,
  LoaderCircle,
  RefreshCcw
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import OpenClawConnectionFormFields, {
  applyOpenClawConnectionFormField,
  createOpenClawConnectionFormState,
  isOpenClawConnectionFormStateValid,
  normalizeOpenClawConnectionFormState,
  type OpenClawConnectionFormState
} from '@/features/instances/components/openclaw-connection-form-fields'
import {
  DEFAULT_LOCAL_GATEWAY_HOST,
  DEFAULT_LOCAL_GATEWAY_PATH,
  DEFAULT_LOCAL_GATEWAY_PORT
} from '@/features/instances/lib/openclaw-connection-config'
import { discoverLocalOpenClaw } from '@/shared/api/app-api'
import { cn } from '@/shared/lib/utils'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { useAppI18n } from '@/shared/i18n/app-i18n'

export type OpenClawFirstInstanceSetupPayload = {
  name: string
  description: string
  connectionConfig: OpenClawConnectionFormState
}

type OpenClawFirstInstanceSetupResult = {
  success: boolean
  message: string
}

type OpenClawFirstInstanceSetupPanelProps = {
  onSubmitSetup: (
    payload: OpenClawFirstInstanceSetupPayload
  ) => Promise<OpenClawFirstInstanceSetupResult>
}

type SetupStep = 'basic' | 'remote' | 'local'

type SetupMethod = 'local' | 'ssh'

const LOCAL_CONNECTING_PREVIEW_DELAY_MS = import.meta.env.MODE === 'test' ? 0 : 2_000

function toErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms)
  })
}

function resolveStepIndex(step: SetupStep): number {
  if (step === 'basic') {
    return 1
  }
  return 2
}

function resolveConnectionTitle(name: string, remoteForm: OpenClawConnectionFormState): string {
  const existingTitle = remoteForm.title.trim()
  if (existingTitle) {
    return existingTitle
  }

  const trimmedHost = remoteForm.host.trim()
  const trimmedUsername = remoteForm.username.trim()
  if (trimmedUsername && trimmedHost) {
    return `${trimmedUsername}@${trimmedHost}`
  }

  return `${name.trim() || 'openclaw'}-connection`
}

function OpenClawFirstInstanceSetupPanel({
  onSubmitSetup
}: OpenClawFirstInstanceSetupPanelProps): React.JSX.Element {
  const { t } = useAppI18n()
  const [step, setStep] = useState<SetupStep>('basic')
  const [method, setMethod] = useState<SetupMethod>('local')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [remoteConnectionForm, setRemoteConnectionForm] = useState<OpenClawConnectionFormState>(
    () => createOpenClawConnectionFormState()
  )
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [localStage, setLocalStage] = useState<'idle' | 'scanning' | 'connecting' | 'failed'>(
    'idle'
  )
  const [localStatusMessage, setLocalStatusMessage] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const stepIndex = resolveStepIndex(step)
  const canContinueBasic = name.trim().length > 0
  const stepDescription = useMemo(() => {
    if (step === 'basic') {
      return t('instances.setup.step.basicDescription')
    }

    if (step === 'local') {
      return t('instances.setup.step.localDescription')
    }

    return t('instances.setup.step.remoteDescription')
  }, [step, t])

  const runLocalSetup = async (): Promise<void> => {
    const trimmedName = name.trim()
    const trimmedDescription = description.trim()

    if (!trimmedName) {
      setSubmitError(t('instances.setup.error.nameRequired'))
      return
    }

    setIsSubmitting(true)
    setSubmitError(null)
    setLocalStage('scanning')

    try {
      const discoveryResult = await discoverLocalOpenClaw({
        preferMode: 'token'
      })

      setLocalStatusMessage(discoveryResult.message)
      setLocalStage('connecting')
      await sleep(LOCAL_CONNECTING_PREVIEW_DELAY_MS)

      const localConnection = normalizeOpenClawConnectionFormState({
        ...createOpenClawConnectionFormState(),
        title: `${trimmedName}-local`,
        connectionType: 'local',
        gatewayToken: discoveryResult.gatewayToken,
        gatewayPassword: discoveryResult.gatewayPassword,
        gatewayHost: DEFAULT_LOCAL_GATEWAY_HOST,
        gatewayPort: DEFAULT_LOCAL_GATEWAY_PORT,
        gatewayPath: DEFAULT_LOCAL_GATEWAY_PATH
      })

      const result = await onSubmitSetup({
        name: trimmedName,
        description: trimmedDescription,
        connectionConfig: localConnection
      })

      if (!result.success) {
        setSubmitError(result.message)
        setLocalStage('failed')
      }
    } catch (error) {
      setSubmitError(toErrorMessage(error, t('instances.setup.error.localConnectFailed')))
      setIsSubmitting(false)
      setLocalStage('failed')
      return
    }

    setIsSubmitting(false)
  }

  useEffect(() => {
    if (step !== 'local' || isSubmitting || localStage !== 'idle') {
      return
    }

    void runLocalSetup()
  }, [isSubmitting, localStage, step])

  const submitRemoteSetup = async (): Promise<void> => {
    const trimmedName = name.trim()
    const trimmedDescription = description.trim()

    if (!trimmedName) {
      setSubmitError(t('instances.setup.error.nameRequired'))
      setStep('basic')
      return
    }

    const normalizedConnection = normalizeOpenClawConnectionFormState({
      ...remoteConnectionForm,
      connectionType: 'ssh',
      title: resolveConnectionTitle(trimmedName, remoteConnectionForm)
    })

    if (!isOpenClawConnectionFormStateValid(normalizedConnection)) {
      setSubmitError(t('instances.setup.error.remoteConfigIncomplete'))
      return
    }

    setSubmitError(null)
    setIsSubmitting(true)
    try {
      const result = await onSubmitSetup({
        name: trimmedName,
        description: trimmedDescription,
        connectionConfig: normalizedConnection
      })

      if (!result.success) {
        setSubmitError(result.message)
      }
    } catch (error) {
      setSubmitError(toErrorMessage(error, t('instances.setup.error.remoteConnectFailed')))
    } finally {
      setIsSubmitting(false)
    }
  }

  const renderStepContent = (): React.JSX.Element => {
    if (step === 'basic') {
      const options: Array<{
        id: SetupMethod
        title: string
        description: string
        icon: React.JSX.Element
      }> = [
        {
          id: 'local',
          title: t('instances.setup.option.local.title'),
          description: t('instances.setup.option.local.description'),
          icon: <Laptop className="size-4" />
        },
        {
          id: 'ssh',
          title: t('instances.setup.option.ssh.title'),
          description: t('instances.setup.option.ssh.description'),
          icon: <Globe className="size-4" />
        }
      ]

      return (
        <div className="grid gap-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <section className="flex flex-col gap-2">
              <label className="text-sm font-medium text-foreground" htmlFor="first-instance-name">
                {t('instances.setup.field.instanceName')}
              </label>
              <Input
                id="first-instance-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder={t('instances.setup.field.instanceName.placeholder')}
                required
              />
            </section>

            <section className="flex flex-col gap-2">
              <label
                className="text-sm font-medium text-foreground"
                htmlFor="first-instance-description"
              >
                {t('instances.setup.field.instanceDescription')}
              </label>
              <Input
                id="first-instance-description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder={t('instances.setup.field.instanceDescription.placeholder')}
              />
            </section>
          </div>

          <section className="pt-1">
            <p className="text-sm font-medium text-foreground">
              {t('instances.setup.field.connectionMethod')}
            </p>
            <div className="mt-2 grid gap-3 sm:grid-cols-2">
              {options.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  className={cn(
                    'rounded-[0.85rem] border px-4 py-4 text-left transition-colors',
                    method === option.id
                      ? 'border-primary/60 bg-primary/5'
                      : 'border-black/10 hover:border-black/20'
                  )}
                  onClick={() => setMethod(option.id)}
                >
                  <span className="mb-2 inline-flex size-8 items-center justify-center rounded-[0.6rem] bg-primary/10 text-primary">
                    {option.icon}
                  </span>
                  <p className="text-sm font-medium text-foreground">{option.title}</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    {option.description}
                  </p>
                </button>
              ))}
            </div>
          </section>
        </div>
      )
    }

    if (step === 'local') {
      return (
        <div className="rounded-[0.9rem] border border-black/8 bg-muted/20 px-4 py-5 text-center">
          <div className="mx-auto mb-3 flex size-11 items-center justify-center rounded-full border border-primary/20 bg-white">
            {isSubmitting ? (
              <LoaderCircle className="size-5 animate-spin text-primary" />
            ) : submitError ? (
              <Globe className="size-5 text-rose-600" />
            ) : (
              <CheckCircle2 className="size-5 text-emerald-600" />
            )}
          </div>
          <p className="text-sm font-semibold text-foreground">
            {isSubmitting
              ? localStage === 'scanning'
                ? t('instances.setup.local.status.scanning')
                : t('instances.setup.local.status.connecting')
              : submitError
                ? t('instances.setup.local.status.failed')
                : t('instances.setup.local.status.connected')}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {submitError
              ? t('instances.setup.local.hint.failed')
              : (localStatusMessage ?? t('instances.setup.local.hint.scanning'))}
          </p>
        </div>
      )
    }

    return (
      <div className="grid gap-3">
        <OpenClawConnectionFormFields
          values={remoteConnectionForm}
          onValueChange={(field, value) => {
            setRemoteConnectionForm((current) => ({
              ...applyOpenClawConnectionFormField(current, field, value),
              connectionType: 'ssh'
            }))
          }}
          fieldIdPrefix="first-instance-remote-connection"
          showConnectionTypeSelector={false}
        />
      </div>
    )
  }

  const renderStepActions = (): React.JSX.Element => {
    if (step === 'basic') {
      return (
        <Button
          type="button"
          className="h-9 rounded-[0.75rem] px-4 text-sm"
          disabled={!canContinueBasic}
          onClick={() => {
            setSubmitError(null)
            setLocalStatusMessage(null)
            setLocalStage('idle')
            setStep(method === 'local' ? 'local' : 'remote')
          }}
        >
          <ArrowRight className="size-4" />
          {t('instances.setup.action.continue')}
        </Button>
      )
    }

    if (step === 'local') {
      return (
        <>
          {submitError ? (
            <Button
              type="button"
              className="h-9 rounded-[0.75rem] px-4 text-sm"
              onClick={() => {
                setSubmitError(null)
                setLocalStatusMessage(null)
                setLocalStage('idle')
              }}
            >
              <RefreshCcw className="size-4" />
              {t('instances.setup.action.retryConnect')}
            </Button>
          ) : (
            <Button type="button" className="h-9 rounded-[0.75rem] px-4 text-sm" disabled>
              <LoaderCircle className="size-4 animate-spin" />
              {t('instances.setup.action.autoConnecting')}
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-9 rounded-[0.75rem] text-muted-foreground hover:bg-black/5 hover:text-foreground"
            aria-label={t('instances.setup.action.backStep')}
            title={t('instances.setup.action.backStep')}
            disabled={isSubmitting}
            onClick={() => {
              setSubmitError(null)
              setStep('basic')
            }}
          >
            <ChevronLeft className="size-4" />
          </Button>
        </>
      )
    }

    return (
      <>
        <Button
          type="button"
          className="h-9 rounded-[0.75rem] px-4 text-sm"
          disabled={isSubmitting}
          onClick={() => {
            void submitRemoteSetup()
          }}
        >
          <CheckCircle2 className="size-4" />
          {isSubmitting
            ? t('instances.setup.action.connecting')
            : t('instances.setup.action.completeAndConnect')}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-9 rounded-[0.75rem] text-muted-foreground hover:bg-black/5 hover:text-foreground"
          aria-label={t('instances.setup.action.backStep')}
          title={t('instances.setup.action.backStep')}
          disabled={isSubmitting}
          onClick={() => {
            setSubmitError(null)
            setStep('basic')
          }}
        >
          <ChevronLeft className="size-4" />
        </Button>
      </>
    )
  }

  return (
    <section className="mx-auto flex w-full max-w-3xl flex-1 items-center justify-center py-3">
      <div className="flex max-h-[min(76vh,40rem)] w-full flex-col overflow-hidden rounded-[0.9rem] border border-black/8 bg-card shadow-[0_24px_54px_-48px_rgba(15,23,42,0.35)]">
        <header className="flex shrink-0 items-center justify-between px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-base font-semibold tracking-tight text-foreground">
              {t('instances.setup.title.firstGuide')}
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">{stepDescription}</p>
          </div>
          <div className="ml-4 flex items-center gap-1.5">
            {[1, 2].map((index) => (
              <span
                key={index}
                className={cn(
                  'h-1.5 w-7 rounded-full',
                  index <= stepIndex ? 'bg-primary' : 'bg-black/10'
                )}
              />
            ))}
          </div>
        </header>

        <div
          className={cn(
            'min-h-0 border-y border-black/6',
            step === 'basic' ? 'overflow-hidden' : 'overflow-y-auto'
          )}
        >
          <div className="px-5 py-5">{renderStepContent()}</div>
        </div>

        <footer className="flex shrink-0 items-center justify-between gap-3 px-5 py-4">
          <div className="flex items-center gap-2">{renderStepActions()}</div>
          {submitError ? (
            <p className="min-w-0 truncate text-xs text-rose-600" title={submitError}>
              {submitError}
            </p>
          ) : null}
        </footer>
      </div>
    </section>
  )
}

export default OpenClawFirstInstanceSetupPanel
