import type { SshConnectionFormValues } from '@/features/instances/model/ssh-connection'
import {
  DEFAULT_LOCAL_GATEWAY_HOST,
  DEFAULT_LOCAL_GATEWAY_PATH,
  DEFAULT_LOCAL_GATEWAY_PORT,
  normalizeGatewayPath,
  resolveGatewayHost,
  resolveGatewayPort,
  resolveOpenClawConnectionType
} from '@/features/instances/lib/openclaw-connection-config'
import { useAppI18n } from '@/shared/i18n/app-i18n'
import { Input } from '@/shared/ui/input'

export type OpenClawConnectionFormState = SshConnectionFormValues & {
  connectionType: 'ssh' | 'local'
  privateKeyPassphrase: string
  gatewayToken: string
  gatewayPassword: string
  gatewayHost: string
  gatewayPort: number
  gatewayPath: string
}

type OpenClawConnectionFormFieldsProps = {
  values: OpenClawConnectionFormState
  onValueChange: (field: keyof OpenClawConnectionFormState, value: string) => void
  fieldIdPrefix?: string
  showConnectionTypeSelector?: boolean
  showConnectionTitle?: boolean
}

type OpenClawConnectionFormStateOptions = {
  instanceName?: string
  connectionConfig?: SshConnectionFormValues | null
}

type OpenClawConnectionFieldProps = {
  htmlFor: string
  label: string
  children: React.JSX.Element
}

function OpenClawConnectionField({
  htmlFor,
  label,
  children
}: OpenClawConnectionFieldProps): React.JSX.Element {
  return (
    <section className="flex flex-col gap-2">
      <label className="text-sm font-medium text-foreground" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
    </section>
  )
}

export function createOpenClawConnectionFormState(
  options?: OpenClawConnectionFormStateOptions
): OpenClawConnectionFormState {
  if (!options?.connectionConfig) {
    return {
      title: options?.instanceName ?? '',
      connectionType: 'ssh',
      port: 22,
      host: '',
      username: '',
      password: '',
      privateKey: '',
      privateKeyPassphrase: '',
      gatewayToken: '',
      gatewayPassword: '',
      gatewayHost: DEFAULT_LOCAL_GATEWAY_HOST,
      gatewayPort: DEFAULT_LOCAL_GATEWAY_PORT,
      gatewayPath: DEFAULT_LOCAL_GATEWAY_PATH
    }
  }

  const connectionConfig = options.connectionConfig
  return {
    title: connectionConfig.title,
    connectionType: resolveOpenClawConnectionType(connectionConfig),
    port: connectionConfig.port,
    host: connectionConfig.host,
    username: connectionConfig.username,
    password: connectionConfig.password,
    privateKey: connectionConfig.privateKey,
    privateKeyPassphrase: connectionConfig.privateKeyPassphrase ?? '',
    gatewayToken: connectionConfig.gatewayToken ?? '',
    gatewayPassword: connectionConfig.gatewayPassword ?? '',
    gatewayHost: connectionConfig.gatewayHost ?? DEFAULT_LOCAL_GATEWAY_HOST,
    gatewayPort: connectionConfig.gatewayPort ?? DEFAULT_LOCAL_GATEWAY_PORT,
    gatewayPath: normalizeGatewayPath(connectionConfig.gatewayPath)
  }
}

export function applyOpenClawConnectionFormField(
  values: OpenClawConnectionFormState,
  field: keyof OpenClawConnectionFormState,
  value: string
): OpenClawConnectionFormState {
  if (field === 'port' || field === 'gatewayPort') {
    const parsedPort = Number(value)
    return {
      ...values,
      [field]: Number.isNaN(parsedPort) ? 0 : parsedPort
    }
  }

  return {
    ...values,
    [field]: value
  }
}

export function normalizeOpenClawConnectionFormState(
  values: OpenClawConnectionFormState
): OpenClawConnectionFormState {
  return {
    ...values,
    title: values.title.trim(),
    host: values.host.trim(),
    username: values.username.trim(),
    gatewayHost: resolveGatewayHost(values),
    gatewayPort: resolveGatewayPort(values),
    gatewayPath: normalizeGatewayPath(values.gatewayPath)
  }
}

export function isOpenClawConnectionFormStateValid(values: OpenClawConnectionFormState): boolean {
  if (!values.title) {
    return false
  }

  if (values.connectionType === 'local') {
    return true
  }

  return Boolean(
    values.host && values.username && values.password.trim() && values.privateKey.trim()
  )
}

function resolveFieldId(prefix: string, field: string): string {
  return `${prefix}-${field}`
}

function OpenClawConnectionFormFields({
  values,
  onValueChange,
  fieldIdPrefix = 'openclaw-connection',
  showConnectionTypeSelector = true,
  showConnectionTitle = true
}: OpenClawConnectionFormFieldsProps): React.JSX.Element {
  const { t } = useAppI18n()
  const isLocalMode = values.connectionType === 'local'
  const connectionTypeId = resolveFieldId(fieldIdPrefix, 'type')
  const titleId = resolveFieldId(fieldIdPrefix, 'title')
  const portId = resolveFieldId(fieldIdPrefix, 'port')
  const gatewayPortId = resolveFieldId(fieldIdPrefix, 'gateway-port')
  const gatewayHostId = resolveFieldId(fieldIdPrefix, 'gateway-host')
  const gatewayPathId = resolveFieldId(fieldIdPrefix, 'gateway-path')
  const hostId = resolveFieldId(fieldIdPrefix, 'host')
  const usernameId = resolveFieldId(fieldIdPrefix, 'username')
  const passwordId = resolveFieldId(fieldIdPrefix, 'password')
  const gatewayTokenId = resolveFieldId(fieldIdPrefix, 'gateway-token')
  const gatewayPasswordId = resolveFieldId(fieldIdPrefix, 'gateway-password')
  const privateKeyId = resolveFieldId(fieldIdPrefix, 'private-key')
  const privateKeyPassphraseId = resolveFieldId(fieldIdPrefix, 'private-key-passphrase')

  return (
    <div className="grid gap-3">
      {showConnectionTypeSelector ? (
        <OpenClawConnectionField
          htmlFor={connectionTypeId}
          label={t('instances.connectionForm.field.connectionType')}
        >
          <div
            id={connectionTypeId}
            className="inline-flex h-9 items-center rounded-[0.72rem] border border-black/8 bg-[#F8FAFD] p-[3px]"
          >
            <button
              type="button"
              aria-pressed={values.connectionType === 'ssh'}
              className={`inline-flex h-7 min-w-[6.6rem] items-center justify-center rounded-[0.58rem] px-3 text-xs font-medium transition-colors ${
                values.connectionType === 'ssh'
                  ? 'bg-white text-foreground shadow-[0_8px_18px_-16px_rgba(15,23,42,0.4)]'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              onClick={() => onValueChange('connectionType', 'ssh')}
            >
              {t('instances.connectionForm.option.remoteSsh')}
            </button>
            <button
              type="button"
              aria-pressed={values.connectionType === 'local'}
              className={`inline-flex h-7 min-w-[6.2rem] items-center justify-center rounded-[0.58rem] px-3 text-xs font-medium transition-colors ${
                values.connectionType === 'local'
                  ? 'bg-white text-foreground shadow-[0_8px_18px_-16px_rgba(15,23,42,0.4)]'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              onClick={() => onValueChange('connectionType', 'local')}
            >
              {t('instances.connectionForm.option.localDirect')}
            </button>
          </div>
        </OpenClawConnectionField>
      ) : null}

      <div data-testid="ssh-title-row" className="grid gap-4 sm:grid-cols-2">
        {showConnectionTitle ? (
          <OpenClawConnectionField
            htmlFor={titleId}
            label={t('instances.connectionForm.field.connectionName')}
          >
            <Input
              density="sm"
              id={titleId}
              value={values.title}
              onChange={(event) => onValueChange('title', event.target.value)}
              placeholder={
                isLocalMode
                  ? t('instances.connectionForm.placeholder.connectionNameLocal')
                  : t('instances.connectionForm.placeholder.connectionNameRemote')
              }
              required
            />
          </OpenClawConnectionField>
        ) : null}

        {isLocalMode ? (
          <OpenClawConnectionField
            htmlFor={gatewayPortId}
            label={t('instances.connectionForm.field.gatewayPort')}
          >
            <Input
              density="sm"
              id={gatewayPortId}
              type="number"
              min={1}
              max={65535}
              value={values.gatewayPort}
              onChange={(event) => onValueChange('gatewayPort', event.target.value)}
              placeholder={String(DEFAULT_LOCAL_GATEWAY_PORT)}
              required
            />
          </OpenClawConnectionField>
        ) : (
          <OpenClawConnectionField htmlFor={portId} label={t('instances.connectionForm.field.sshPort')}>
            <Input
              density="sm"
              id={portId}
              type="number"
              min={1}
              max={65535}
              value={values.port}
              onChange={(event) => onValueChange('port', event.target.value)}
              placeholder="22"
              required
            />
          </OpenClawConnectionField>
        )}
      </div>

      {isLocalMode ? (
        <div data-testid="local-gateway-row" className="grid gap-4 sm:grid-cols-2">
          <OpenClawConnectionField
            htmlFor={gatewayHostId}
            label={t('instances.connectionForm.field.gatewayHost')}
          >
            <Input
              density="sm"
              id={gatewayHostId}
              value={values.gatewayHost}
              onChange={(event) => onValueChange('gatewayHost', event.target.value)}
              placeholder={DEFAULT_LOCAL_GATEWAY_HOST}
              required
            />
          </OpenClawConnectionField>

          <OpenClawConnectionField
            htmlFor={gatewayPathId}
            label={t('instances.connectionForm.field.gatewayPath')}
          >
            <Input
              density="sm"
              id={gatewayPathId}
              value={values.gatewayPath}
              onChange={(event) => onValueChange('gatewayPath', event.target.value)}
              placeholder={DEFAULT_LOCAL_GATEWAY_PATH}
            />
          </OpenClawConnectionField>
        </div>
      ) : (
        <>
          <div data-testid="ssh-access-row" className="grid gap-4 sm:grid-cols-2">
            <OpenClawConnectionField htmlFor={hostId} label={t('instances.connectionForm.field.host')}>
              <Input
                density="sm"
                id={hostId}
                value={values.host}
                onChange={(event) => onValueChange('host', event.target.value)}
                placeholder="10.0.0.10"
                required
              />
            </OpenClawConnectionField>

            <OpenClawConnectionField
              htmlFor={usernameId}
              label={t('instances.connectionForm.field.username')}
            >
              <Input
                density="sm"
                id={usernameId}
                value={values.username}
                onChange={(event) => onValueChange('username', event.target.value)}
                placeholder="root"
                required
              />
            </OpenClawConnectionField>
          </div>

          <OpenClawConnectionField
            htmlFor={passwordId}
            label={t('instances.connectionForm.field.password')}
          >
            <Input
              density="sm"
              id={passwordId}
              type="password"
              value={values.password}
              onChange={(event) => onValueChange('password', event.target.value)}
              placeholder={t('instances.connectionForm.placeholder.password')}
              required
            />
          </OpenClawConnectionField>
        </>
      )}

      <div data-testid="gateway-secret-row" className="grid gap-4 sm:grid-cols-2">
        <OpenClawConnectionField
          htmlFor={gatewayTokenId}
          label={t('instances.connectionForm.field.gatewayToken')}
        >
          <Input
            density="sm"
            id={gatewayTokenId}
            type="password"
            value={values.gatewayToken}
            onChange={(event) => onValueChange('gatewayToken', event.target.value)}
            placeholder="gateway.auth.token"
          />
        </OpenClawConnectionField>

        <OpenClawConnectionField
          htmlFor={gatewayPasswordId}
          label={t('instances.connectionForm.field.gatewayPassword')}
        >
          <Input
            density="sm"
            id={gatewayPasswordId}
            type="password"
            value={values.gatewayPassword}
            onChange={(event) => onValueChange('gatewayPassword', event.target.value)}
            placeholder="gateway.auth.password"
          />
        </OpenClawConnectionField>
      </div>

      {!isLocalMode ? (
        <>
          <OpenClawConnectionField
            htmlFor={privateKeyId}
            label={t('instances.connectionForm.field.privateKey')}
          >
            <div className="overflow-hidden rounded-[0.75rem] border border-black/8 bg-background transition-all hover:border-ring/40 focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/10">
              <textarea
                id={privateKeyId}
                value={values.privateKey}
                onChange={(event) => onValueChange('privateKey', event.target.value)}
                className="min-h-[10rem] w-full resize-none bg-transparent px-3 py-2.5 font-mono text-[12px] leading-5 text-foreground outline-none [scrollbar-gutter:stable]"
                placeholder="-----BEGIN OPENSSH PRIVATE KEY-----"
                required
              />
            </div>
          </OpenClawConnectionField>

          <OpenClawConnectionField
            htmlFor={privateKeyPassphraseId}
            label={t('instances.connectionForm.field.privateKeyPassphrase')}
          >
            <Input
              density="sm"
              id={privateKeyPassphraseId}
              type="password"
              value={values.privateKeyPassphrase}
              onChange={(event) => onValueChange('privateKeyPassphrase', event.target.value)}
              placeholder={t('instances.connectionForm.placeholder.optional')}
            />
          </OpenClawConnectionField>
        </>
      ) : null}
    </div>
  )
}

export default OpenClawConnectionFormFields
