import { Loader2, Upload, X } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'

import type { OpenClawAgentSettingsDraft } from '@/features/agents/lib/openclaw-agent-config-entry'
import { useResolvedAgentAvatarSource, uploadAgentAvatarFile } from '@/features/agents/lib/openclaw-agent-avatar-image'
import type { SshConnectionFormValues } from '@/features/instances/model/ssh-connection'
import { useAppI18n } from '@/shared/i18n/app-i18n'
import { getValueAtPath } from '@/shared/lib/dynamic-form-engine/path-utils'
import type { DynamicFormComponentProps } from '@/shared/lib/dynamic-form-engine/types'
import { cn } from '@/shared/lib/utils'
import { Button } from '@/shared/ui/button'

type AvatarFieldProps = {
  workspaceFieldId?: string
  fallbackWorkspace?: string
  connectionConfig?: SshConnectionFormValues | null
}

function readTrimmedString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function resolveWorkspacePath(
  values: Record<string, unknown>,
  options: AvatarFieldProps | undefined
): string {
  const fromDraft = readTrimmedString(
    getValueAtPath(values, readTrimmedString(options?.workspaceFieldId) || 'workspace')
  )
  if (fromDraft) {
    return fromDraft
  }
  return readTrimmedString(options?.fallbackWorkspace)
}

function OpenClawDynamicFormAvatarField({
  field,
  value,
  onChange,
  disabled,
  invalid,
  error,
  values
}: DynamicFormComponentProps<OpenClawAgentSettingsDraft>): React.JSX.Element {
  const { t } = useAppI18n()
  const options = (field.props ?? {}) as AvatarFieldProps
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [uploading, setUploading] = useState(false)
  const [localPreviewSrc, setLocalPreviewSrc] = useState<string | null>(null)
  const [localError, setLocalError] = useState<string | null>(null)

  const avatarValue = readTrimmedString(value)
  const workspacePath = useMemo(
    () => resolveWorkspacePath(values as Record<string, unknown>, options),
    [options, values]
  )
  const resolvedPreviewSrc = useResolvedAgentAvatarSource({
    avatar: avatarValue,
    workspacePath,
    connectionConfig: options.connectionConfig ?? null
  })
  const previewSrc = localPreviewSrc || resolvedPreviewSrc
  const pending = disabled || uploading

  const handleUploadAvatar = async (file: File): Promise<void> => {
    if (!workspacePath) {
      setLocalError(t('agents.form.avatar.error.needWorkspace'))
      return
    }

    setUploading(true)
    setLocalError(null)
    try {
      const uploaded = await uploadAgentAvatarFile({
        file,
        workspacePath,
        connectionConfig: options.connectionConfig ?? null
      })
      onChange(uploaded.avatar)
      setLocalPreviewSrc(uploaded.previewSrc)
    } catch (uploadError) {
      setLocalError(uploadError instanceof Error ? uploadError.message : t('agents.error.avatar.uploadFailed'))
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        <span
          className={cn(
            'inline-flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-black/10 bg-white',
            invalid ? 'border-rose-300' : null
          )}
        >
          {previewSrc ? (
            <img
              src={previewSrc}
              alt={t('agents.form.avatar.previewAlt')}
              className="size-full object-cover"
              draggable={false}
            />
          ) : (
            <span className="text-base leading-none text-muted-foreground">🤖</span>
          )}
        </span>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={pending}
            onClick={() => {
              fileInputRef.current?.click()
            }}
          >
            {uploading ? <Loader2 className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />}
            {uploading ? t('agents.form.avatar.uploading') : t('agents.form.avatar.upload')}
          </Button>
          {avatarValue ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={pending}
              onClick={() => {
                onChange('')
                setLocalPreviewSrc(null)
                setLocalError(null)
              }}
            >
              <X className="size-3.5" />
              {t('agents.form.avatar.clear')}
            </Button>
          ) : null}
        </div>
      </div>

      {avatarValue ? <p className="text-[11px] text-muted-foreground">{avatarValue}</p> : null}
      {localError ? <p className="text-[11px] text-rose-600">{localError}</p> : null}
      {!localError && invalid && error ? <p className="text-[11px] text-rose-600">{error}</p> : null}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml,image/bmp,image/heic,image/heif"
        className="hidden"
        disabled={pending}
        onChange={(event) => {
          const file = event.currentTarget.files?.[0]
          event.currentTarget.value = ''
          if (!file) {
            return
          }
          void handleUploadAvatar(file)
        }}
      />
    </div>
  )
}

export default OpenClawDynamicFormAvatarField
