import { Loader2, Upload, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'

import { uploadAgentAvatarFile, useResolvedAgentAvatarSource } from '@/features/agents/lib/openclaw-agent-avatar-image'
import type { SshConnectionFormValues } from '@/features/instances/model/ssh-connection'
import { useAppI18n } from '@/shared/i18n/app-i18n'
import { Button } from '@/shared/ui/button'
import DialogShell from '@/shared/ui/dialog-shell'
import { Input } from '@/shared/ui/input'

type OpenClawAgentCreateDialogProps = {
  open: boolean
  submitting?: boolean
  error?: string | null
  connectionConfig?: SshConnectionFormValues | null
  onClose: () => void
  onCreate: (payload: { name: string; workspace?: string; emoji?: string; avatar?: string }) => void
}

function normalizeAgentSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function OpenClawAgentCreateDialog({
  open,
  submitting = false,
  error,
  connectionConfig = null,
  onClose,
  onCreate
}: OpenClawAgentCreateDialogProps): React.JSX.Element | null {
  const { t } = useAppI18n()
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [name, setName] = useState('')
  const [workspace, setWorkspace] = useState('')
  const [emoji, setEmoji] = useState('')
  const [avatar, setAvatar] = useState('')
  const [uploading, setUploading] = useState(false)
  const [avatarUploadError, setAvatarUploadError] = useState<string | null>(null)
  const [localAvatarPreviewSrc, setLocalAvatarPreviewSrc] = useState<string | null>(null)

  const defaultWorkspace = useMemo(() => {
    const slug = normalizeAgentSlug(name)
    if (!slug) {
      return ''
    }

    return `~/.openclaw/workspace/agents/${slug}`
  }, [name])

  useEffect(() => {
    if (!open) {
      return
    }

    setName('')
    setWorkspace('')
    setEmoji('')
    setAvatar('')
    setUploading(false)
    setAvatarUploadError(null)
    setLocalAvatarPreviewSrc(null)
  }, [open])

  const resolvedWorkspace = workspace.trim() || defaultWorkspace
  const resolvedAvatarPreviewSrc = useResolvedAgentAvatarSource({
    avatar,
    workspacePath: resolvedWorkspace,
    connectionConfig
  })
  const avatarPreviewSrc = localAvatarPreviewSrc || resolvedAvatarPreviewSrc
  const canSubmit = !submitting && !uploading && name.trim().length > 0
  const workspacePlaceholder = defaultWorkspace || '~/.openclaw/workspace/agents/<agent-id>'

  if (!open) {
    return null
  }

  const handleSubmit = (): void => {
    if (!canSubmit) {
      return
    }

    onCreate({
      name: name.trim(),
      workspace: resolvedWorkspace || undefined,
      emoji: emoji.trim() || undefined,
      avatar: avatar.trim() || undefined
    })
  }

  const handleUploadAvatar = async (file: File): Promise<void> => {
    if (!resolvedWorkspace) {
      setAvatarUploadError(t('agents.create.error.uploadNeedWorkspace'))
      return
    }

    setUploading(true)
    setAvatarUploadError(null)
    try {
      const uploaded = await uploadAgentAvatarFile({
        file,
        workspacePath: resolvedWorkspace,
        connectionConfig
      })
      setAvatar(uploaded.avatar)
      setLocalAvatarPreviewSrc(uploaded.previewSrc)
    } catch (uploadError) {
      setAvatarUploadError(uploadError instanceof Error ? uploadError.message : t('agents.error.avatar.uploadFailed'))
    } finally {
      setUploading(false)
    }
  }

  return (
    <DialogShell
      title={t('agents.create.title')}
      onClose={onClose}
      maxWidthClassName="max-w-[calc(100vw-1.5rem)] sm:max-w-[34rem] lg:max-w-[min(46vw,34rem)]"
    >
      <div className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground" htmlFor="agent-create-name">
            {t('agents.create.nameLabel')}
          </label>
          <Input
            id="agent-create-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={t('agents.create.namePlaceholder')}
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground" htmlFor="agent-create-workspace">
            {t('agents.create.workspaceLabel')}
          </label>
          <Input
            id="agent-create-workspace"
            value={workspace}
            onChange={(event) => setWorkspace(event.target.value)}
            placeholder={workspacePlaceholder}
          />
          <p className="text-xs leading-5 text-muted-foreground">
            {t('agents.create.workspaceHint', { path: workspacePlaceholder })}
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground" htmlFor="agent-create-emoji">
              {t('agents.create.emojiLabel')}
            </label>
            <Input
              id="agent-create-emoji"
              value={emoji}
              onChange={(event) => setEmoji(event.target.value)}
              placeholder={t('agents.create.emojiPlaceholder')}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">{t('agents.create.avatarLabel')}</label>
            <div className="flex items-center gap-3">
              <span className="inline-flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-black/10 bg-white">
                {avatarPreviewSrc ? (
                  <img
                    src={avatarPreviewSrc}
                    alt={t('agents.create.avatarPreviewAlt')}
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
                  disabled={submitting || uploading}
                  onClick={() => {
                    fileInputRef.current?.click()
                  }}
                >
                  {uploading ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Upload className="size-3.5" />
                  )}
                  {uploading ? t('agents.create.uploading') : t('agents.create.upload')}
                </Button>
                {avatar.trim() ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={submitting || uploading}
                    onClick={() => {
                      setAvatar('')
                      setLocalAvatarPreviewSrc(null)
                      setAvatarUploadError(null)
                    }}
                  >
                    <X className="size-3.5" />
                    {t('agents.create.clear')}
                  </Button>
                ) : null}
              </div>
            </div>
            {avatar.trim() ? <p className="text-[11px] text-muted-foreground">{avatar}</p> : null}
            {avatarUploadError ? (
              <p className="text-[11px] text-rose-600">{avatarUploadError}</p>
            ) : null}
          </div>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml,image/bmp,image/heic,image/heif"
          className="hidden"
          disabled={submitting || uploading}
          onChange={(event) => {
            const file = event.currentTarget.files?.[0]
            event.currentTarget.value = ''
            if (!file) {
              return
            }
            void handleUploadAvatar(file)
          }}
        />

        {error ? (
          <p className="rounded-[0.7rem] border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {error}
          </p>
        ) : null}

        <div className="flex items-center justify-end gap-2.5">
          <Button type="button" variant="outline" onClick={onClose}>
            {t('agents.create.cancel')}
          </Button>
          <Button type="button" disabled={!canSubmit} onClick={handleSubmit}>
            {submitting ? t('agents.create.submitting') : t('agents.create.submit')}
          </Button>
        </div>
      </div>
    </DialogShell>
  )
}

export default OpenClawAgentCreateDialog
