import { CheckCircle2, Globe, Laptop, LoaderCircle } from 'lucide-react'
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
import DialogShell from '@/shared/ui/dialog-shell'
import { Input } from '@/shared/ui/input'
import { useAppI18n } from '@/shared/i18n/app-i18n'

export type OpenClawCreateSetupPayload = {
  name: string
  description: string
  connectionConfig: OpenClawConnectionFormState
}

type OpenClawCreateSetupResult = {
  success: boolean
  message: string
}

type OpenClawCreateDialogProps = {
  open: boolean
  onClose: () => void
  onSubmitSetup: (payload: OpenClawCreateSetupPayload) => Promise<OpenClawCreateSetupResult>
  hasLocalInstance?: boolean
}

type SetupStep = 'basic' | 'remote' | 'local'

type SetupMethod = 'local' | 'ssh'

const LOCAL_CONNECTING_PREVIEW_DELAY_MS = import.meta.env.MODE === 'test' ? 0 : 2_000

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms)
  })
}

function toErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback
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

function OpenClawCreateDialog({
  open,
  onClose,
  onSubmitSetup,
  hasLocalInstance = false
}: OpenClawCreateDialogProps): React.JSX.Element | null {
  if (!open) {
    return null
  }

  return (
    <OpenClawCreateDialogContent
      hasLocalInstance={hasLocalInstance}
      onClose={onClose}
      onSubmitSetup={onSubmitSetup}
    />
  )
}

type OpenClawCreateDialogContentProps = {
  onClose: () => void
  onSubmitSetup: (payload: OpenClawCreateSetupPayload) => Promise<OpenClawCreateSetupResult>
  hasLocalInstance: boolean
}

function OpenClawCreateDialogContent({
  onClose,
  onSubmitSetup,
  hasLocalInstance
}: OpenClawCreateDialogContentProps): React.JSX.Element {
  const { t } = useAppI18n()
  const [step, setStep] = useState<SetupStep>('basic')
  const [method, setMethod] = useState<SetupMethod>(hasLocalInstance ? 'ssh' : 'local')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [remoteConnectionForm, setRemoteConnectionForm] = useState<OpenClawConnectionFormState>(() =>
    createOpenClawConnectionFormState()
  )
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [localStage, setLocalStage] = useState<'idle' | 'scanning' | 'connecting' | 'failed'>(
    'idle'
  )
  const [localStatusMessage, setLocalStatusMessage] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const canContinueBasic = name.trim().length > 0
  const localOptionDisabled = hasLocalInstance
  const localOptionDescription = useMemo(() => {
    if (localOptionDisabled) {
      return t('instances.setup.option.local.descriptionDisabled')
    }
    return t('instances.setup.option.local.description')
  }, [localOptionDisabled, t])

  useEffect(() => {
    if (hasLocalInstance && method === 'local') {
      setMethod('ssh')
    }
  }, [hasLocalInstance, method])

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
        setIsSubmitting(false)
        return
      }

      onClose()
    } catch (error) {
      setSubmitError(toErrorMessage(error, t('instances.setup.error.localConnectFailed')))
      setIsSubmitting(false)
      setLocalStage('failed')
    }
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
        return
      }

      onClose()
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
          description: localOptionDescription,
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
              <label className="text-sm font-medium text-foreground" htmlFor="new-instance-name">
                {t('instances.setup.field.instanceName')}
              </label>
              <Input
                id="new-instance-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder={t('instances.setup.field.instanceName.placeholder')}
                required
              />
            </section>

            <section className="flex flex-col gap-2">
              <label className="text-sm font-medium text-foreground" htmlFor="new-instance-description">
                {t('instances.setup.field.instanceDescription')}
              </label>
              <Input
                id="new-instance-description"
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
                  disabled={option.id === 'local' && localOptionDisabled}
                  className={cn(
                    'rounded-[0.85rem] border px-4 py-4 text-left transition-colors',
                    option.id === 'local' && localOptionDisabled
                      ? 'cursor-not-allowed border-black/10 bg-muted/35 text-muted-foreground'
                      : method === option.id
                      ? 'border-primary/60 bg-primary/5'
                      : 'border-black/10 hover:border-black/20'
                  )}
                  onClick={() => {
                    if (option.id === 'local' && localOptionDisabled) {
                      return
                    }
                    setMethod(option.id)
                  }}
                >
                  <span
                    className={cn(
                      'mb-2 inline-flex size-8 items-center justify-center rounded-[0.6rem]',
                      option.id === 'local' && localOptionDisabled
                        ? 'bg-black/5 text-muted-foreground'
                        : 'bg-primary/10 text-primary'
                    )}
                  >
                    {option.icon}
                  </span>
                  <p className="text-sm font-medium text-foreground">{option.title}</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">{option.description}</p>
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
              : localStatusMessage ?? t('instances.setup.local.hint.scanning')}
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
          fieldIdPrefix="new-instance-remote-connection"
          showConnectionTypeSelector={false}
        />
      </div>
    )
  }

  const renderActions = (): React.JSX.Element => {
    if (step === 'basic') {
      return (
        <>
          <Button type="button" variant="outline" className="rounded-[0.75rem]" onClick={onClose}>
            {t('instances.setup.action.cancel')}
          </Button>
          <Button
            type="button"
            className="rounded-[0.75rem]"
            disabled={!canContinueBasic}
            onClick={() => {
              setSubmitError(null)
              setLocalStatusMessage(null)
              setLocalStage('idle')
              setStep(method === 'local' ? 'local' : 'remote')
            }}
          >
            {t('instances.setup.action.next')}
          </Button>
        </>
      )
    }

    if (step === 'local') {
      return (
        <>
          <Button
            type="button"
            variant="outline"
            className="rounded-[0.75rem]"
            disabled={isSubmitting}
            onClick={onClose}
          >
            {t('instances.setup.action.cancel')}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="rounded-[0.75rem]"
            disabled={isSubmitting}
            onClick={() => {
              setSubmitError(null)
              setStep('basic')
            }}
          >
            {t('instances.setup.action.back')}
          </Button>
          {submitError ? (
            <Button
              type="button"
              className="rounded-[0.75rem]"
              onClick={() => {
                setSubmitError(null)
                setLocalStatusMessage(null)
                setLocalStage('idle')
              }}
            >
              {t('instances.setup.action.retryConnect')}
            </Button>
          ) : (
            <Button type="button" className="rounded-[0.75rem]" disabled>
              {t('instances.setup.action.autoConnecting')}
            </Button>
          )}
        </>
      )
    }

    return (
      <>
        <Button
          type="button"
          variant="outline"
          className="rounded-[0.75rem]"
          disabled={isSubmitting}
          onClick={onClose}
        >
          {t('instances.setup.action.cancel')}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="rounded-[0.75rem]"
          disabled={isSubmitting}
          onClick={() => {
            setSubmitError(null)
            setStep('basic')
          }}
        >
          {t('instances.setup.action.back')}
        </Button>
        <Button
          type="button"
          className="rounded-[0.75rem]"
          disabled={isSubmitting}
          onClick={() => {
            void submitRemoteSetup()
          }}
        >
          {isSubmitting
            ? t('instances.setup.action.connecting')
            : t('instances.setup.action.completeAndConnect')}
        </Button>
      </>
    )
  }

  return (
    <DialogShell
      title={t('instances.setup.title.addDialog')}
      maxWidthClassName="max-w-[calc(100vw-1.5rem)] lg:max-w-[min(50vw,42rem)]"
      onClose={onClose}
    >
      <div className="flex flex-col gap-4">
        <div className={cn(step === 'basic' ? '' : 'max-h-[45vh] overflow-y-auto pr-1')}>
          {renderStepContent()}
        </div>

        <div className="flex items-center gap-3 border-t border-black/6 pt-3">
          {submitError ? <p className="mr-auto text-xs text-rose-600">{submitError}</p> : null}
          <div className={cn('ml-auto flex items-center gap-3', submitError ? '' : 'w-full justify-end')}>
            {renderActions()}
          </div>
        </div>
      </div>
    </DialogShell>
  )
}

export default OpenClawCreateDialog
