import { useState } from 'react'

import type { SshConnectionFormValues } from '@/features/instances/model/ssh-connection'
import { useAppI18n } from '@/shared/i18n/app-i18n'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { Textarea } from '@/shared/ui/textarea'

type SshConnectionFormSubmitResult = {
  success: boolean
  message: string
}

type SshConnectionFormProps = {
  onSubmit?: (values: SshConnectionFormValues) => Promise<SshConnectionFormSubmitResult> | void
}

function SshConnectionForm({ onSubmit }: SshConnectionFormProps): React.JSX.Element {
  const { t } = useAppI18n()
  const [formValues, setFormValues] = useState<SshConnectionFormValues>({
    title: '',
    connectionType: 'ssh',
    port: 22,
    host: '',
    username: '',
    password: '',
    privateKey: '',
    privateKeyPassphrase: '',
    gatewayToken: '',
    gatewayPassword: '',
    gatewayOrigin: '',
    gatewayHost: '127.0.0.1',
    gatewayPort: 18789,
    gatewayPath: '/'
  })
  const [submitting, setSubmitting] = useState(false)
  const [submitResult, setSubmitResult] = useState<SshConnectionFormSubmitResult | null>(null)

  const handleChange = (field: keyof SshConnectionFormValues, value: string): void => {
    if (field === 'port') {
      const parsedPort = Number(value)
      setFormValues((current) => ({ ...current, port: Number.isNaN(parsedPort) ? 0 : parsedPort }))
      return
    }

    setFormValues((current) => ({ ...current, [field]: value }))
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault()

    if (!onSubmit) {
      return
    }

    setSubmitting(true)
    setSubmitResult(null)

    try {
      const result = await onSubmit(formValues)
      if (result) {
        setSubmitResult(result)
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form className="flex max-w-2xl flex-col gap-4" onSubmit={handleSubmit}>
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium" htmlFor="ssh-title">
          {t('instances.sshForm.field.title')}
        </label>
        <Input
          density="sm"
          id="ssh-title"
          value={formValues.title}
          onChange={(event) => handleChange('title', event.target.value)}
          required
          placeholder={t('instances.sshForm.placeholder.title')}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium" htmlFor="ssh-port">
            {t('instances.sshForm.field.port')}
          </label>
          <Input
            density="sm"
            id="ssh-port"
            type="number"
            min={1}
            max={65535}
            value={formValues.port}
            onChange={(event) => handleChange('port', event.target.value)}
            required
            placeholder="22"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium" htmlFor="ssh-host">
            {t('instances.sshForm.field.host')}
          </label>
          <Input
            density="sm"
            id="ssh-host"
            value={formValues.host}
            onChange={(event) => handleChange('host', event.target.value)}
            required
            placeholder="192.168.1.100"
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium" htmlFor="ssh-username">
            {t('instances.sshForm.field.username')}
          </label>
          <Input
            density="sm"
            id="ssh-username"
            value={formValues.username}
            onChange={(event) => handleChange('username', event.target.value)}
            required
            placeholder="root"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium" htmlFor="ssh-password">
            {t('instances.sshForm.field.password')}
          </label>
          <Input
            density="sm"
            id="ssh-password"
            type="password"
            value={formValues.password}
            onChange={(event) => handleChange('password', event.target.value)}
            required
            placeholder={t('instances.sshForm.placeholder.password')}
          />
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium" htmlFor="ssh-private-key">
          {t('instances.sshForm.field.privateKey')}
        </label>
        <Textarea
          id="ssh-private-key"
          value={formValues.privateKey}
          onChange={(event) => handleChange('privateKey', event.target.value)}
          required
          className="min-h-40"
          placeholder="-----BEGIN OPENSSH PRIVATE KEY-----"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium" htmlFor="ssh-private-key-passphrase">
          {t('instances.sshForm.field.privateKeyPassphrase')}
        </label>
        <Input
          density="sm"
          id="ssh-private-key-passphrase"
          type="password"
          value={formValues.privateKeyPassphrase}
          onChange={(event) => handleChange('privateKeyPassphrase', event.target.value)}
          placeholder={t('instances.sshForm.placeholder.privateKeyPassphrase')}
        />
      </div>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={submitting}>
          {submitting ? t('instances.sshForm.action.connecting') : t('instances.sshForm.action.testConnection')}
        </Button>

        {submitResult ? (
          <p className={submitResult.success ? 'text-sm text-green-600' : 'text-sm text-red-600'}>
            {submitResult.message}
          </p>
        ) : null}
      </div>
    </form>
  )
}

export default SshConnectionForm
