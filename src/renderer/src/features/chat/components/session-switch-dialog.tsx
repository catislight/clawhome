import { Loader2 } from 'lucide-react'
import { useMemo, useState } from 'react'

import { Button } from '@/shared/ui/button'
import DialogShell from '@/shared/ui/dialog-shell'
import { Input } from '@/shared/ui/input'
import { OverflowMenu } from '@/shared/ui/overflow-menu'
import { isSameGatewaySessionKey } from '@/features/chat/lib/gateway-chat'
import { useAppI18n } from '@/shared/i18n/app-i18n'
import {
  formatGatewaySessionTimestamp,
  getGatewaySessionTitle,
  isGatewayMainSessionKey,
  type GatewaySessionListItem
} from '@/features/chat/lib/gateway-sessions'
import { cn } from '@/shared/lib/utils'

type SessionSwitchDialogProps = {
  sessions: GatewaySessionListItem[]
  currentSessionKey: string
  pendingSessionKey: string
  undeletableSessionKeys?: string[]
  loading: boolean
  error: string | null
  onRetry: () => void
  onSelectSession: (sessionKey: string) => void
  onRenameSession: (sessionKey: string, nextName: string) => Promise<void>
  onDeleteSession: (sessionKey: string) => Promise<void>
  onConfirm: () => void
  onClose: () => void
}

function SessionSwitchDialog({
  sessions,
  currentSessionKey,
  pendingSessionKey,
  undeletableSessionKeys = [],
  loading,
  error,
  onRetry,
  onSelectSession,
  onRenameSession,
  onDeleteSession,
  onConfirm,
  onClose
}: SessionSwitchDialogProps): React.JSX.Element {
  const { t } = useAppI18n()
  const [renameTargetSessionKey, setRenameTargetSessionKey] = useState<string | null>(null)
  const [renameDraft, setRenameDraft] = useState('')
  const [deleteTargetSessionKey, setDeleteTargetSessionKey] = useState<string | null>(null)
  const [menuOpenSessionKey, setMenuOpenSessionKey] = useState<string | null>(null)
  const [actionPending, setActionPending] = useState<'rename' | 'delete' | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const renameTarget = useMemo(
    () =>
      renameTargetSessionKey
        ? sessions.find((session) => isSameGatewaySessionKey(session.key, renameTargetSessionKey))
        : null,
    [renameTargetSessionKey, sessions]
  )

  const deleteTarget = useMemo(
    () =>
      deleteTargetSessionKey
        ? sessions.find((session) => isSameGatewaySessionKey(session.key, deleteTargetSessionKey))
        : null,
    [deleteTargetSessionKey, sessions]
  )

  const selectedIsCurrent = isSameGatewaySessionKey(pendingSessionKey, currentSessionKey)
  const dialogBusy = loading || actionPending !== null
  const canConfirm =
    !dialogBusy &&
    !error &&
    sessions.length > 0 &&
    !selectedIsCurrent &&
    !renameTargetSessionKey &&
    !deleteTargetSessionKey
  const canCloseMainDialog =
    !dialogBusy && !renameTargetSessionKey && !deleteTargetSessionKey && !menuOpenSessionKey

  const isSessionUndeletable = (sessionKey: string): boolean => {
    if (isGatewayMainSessionKey(sessionKey)) {
      return true
    }

    return undeletableSessionKeys.some((key) => isSameGatewaySessionKey(key, sessionKey))
  }

  const openRenameDialog = (session: GatewaySessionListItem): void => {
    setActionError(null)
    setDeleteTargetSessionKey(null)
    setRenameTargetSessionKey(session.key)
    setRenameDraft(session.label?.trim() || getGatewaySessionTitle(session))
  }

  const openDeleteDialog = (session: GatewaySessionListItem): void => {
    if (isSessionUndeletable(session.key)) {
      return
    }

    setActionError(null)
    setRenameTargetSessionKey(null)
    setRenameDraft('')
    setDeleteTargetSessionKey(session.key)
  }

  const closeRenameDialog = (): void => {
    if (actionPending) {
      return
    }

    setRenameTargetSessionKey(null)
    setRenameDraft('')
  }

  const closeDeleteDialog = (): void => {
    if (actionPending) {
      return
    }

    setDeleteTargetSessionKey(null)
  }

  return (
    <>
      <DialogShell
        title={t('chat.session.titleSwitch')}
        onClose={() => {
          if (!canCloseMainDialog) {
            return
          }
          onClose()
        }}
        maxWidthClassName="max-w-[calc(100vw-1.5rem)] sm:max-w-[30rem] lg:max-w-[min(44vw,30rem)]"
      >
        <div className="space-y-4">
          {loading ? (
            <div className="flex min-h-32 items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              <span>{t('chat.session.loadingList')}</span>
            </div>
          ) : error ? (
            <div className="space-y-3">
              <p className="rounded-[0.8rem] border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-sm leading-6 text-rose-700">
                {error}
              </p>
              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="outline"
                  className="h-9 rounded-[0.75rem] px-3.5 text-sm"
                  onClick={onRetry}
                >
                  {t('chat.session.reload')}
                </Button>
              </div>
            </div>
          ) : sessions.length === 0 ? (
            <p className="rounded-[0.8rem] border border-black/8 bg-secondary/45 px-3.5 py-3 text-sm leading-6 text-muted-foreground">
              {t('chat.session.empty')}
            </p>
          ) : (
            <div
              aria-label={t('chat.session.listAria')}
              className="max-h-[min(52vh,24rem)] space-y-2 overflow-y-auto pr-1"
              role="list"
            >
              {sessions.map((session) => {
                const title = getGatewaySessionTitle(session)
                const isSelected = isSameGatewaySessionKey(session.key, pendingSessionKey)
                const isCurrent = isSameGatewaySessionKey(session.key, currentSessionKey)
                const canDelete = !isSessionUndeletable(session.key)
                const metaParts = [
                  title !== session.key ? session.key : null,
                  formatGatewaySessionTimestamp(session.updatedAt)
                ].filter(Boolean)

                return (
                  <div
                    key={session.key}
                    role="listitem"
                    className={cn(
                      'group flex w-full items-start gap-2 rounded-[0.9rem] border px-3 py-2.5 transition-colors',
                      isSelected
                        ? 'border-primary/22 bg-primary/7'
                        : 'border-black/8 bg-white hover:border-black/12 hover:bg-secondary/45'
                    )}
                  >
                    <button
                      type="button"
                      aria-label={title}
                      aria-pressed={isSelected}
                      className="min-w-0 flex-1 text-left"
                      onClick={() => {
                        setActionError(null)
                        onSelectSession(session.key)
                      }}
                    >
                      <div className="min-w-0 space-y-1">
                        <div className="flex min-w-0 items-center gap-2">
                          <p className="truncate text-sm font-medium text-foreground">{title}</p>
                          {isCurrent ? (
                            <span className="shrink-0 rounded-full border border-black/10 bg-secondary/70 px-2 py-0.5 text-[11px] font-medium leading-4 text-muted-foreground">
                              {t('chat.session.currentTag')}
                            </span>
                          ) : null}
                        </div>
                        {metaParts.length > 0 ? (
                          <p className="truncate text-xs leading-5 text-muted-foreground">
                            {metaParts.join(' · ')}
                          </p>
                        ) : null}
                      </div>
                    </button>

                    <OverflowMenu
                      items={[
                        {
                          key: 'rename',
                          label: t('chat.session.actionRename'),
                          disabled: actionPending !== null,
                          onSelect: () => {
                            openRenameDialog(session)
                          }
                        },
                        {
                          key: 'delete',
                          label: t('chat.session.actionDelete'),
                          hidden: !canDelete,
                          disabled: actionPending !== null,
                          onSelect: () => {
                            openDeleteDialog(session)
                          }
                        }
                      ]}
                      renderInPortal
                      triggerLabel={t('chat.session.actionTrigger', { title })}
                      className={cn(
                        'shrink-0 transition-opacity duration-150',
                        menuOpenSessionKey === session.key
                          ? 'opacity-100'
                          : 'pointer-events-none opacity-0 group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100'
                      )}
                      triggerClassName="size-7 rounded-[0.65rem] text-muted-foreground hover:bg-secondary hover:text-foreground"
                      contentClassName="min-w-[8.5rem]"
                      onOpenChange={(open) => {
                        setMenuOpenSessionKey((current) => {
                          if (open) {
                            return session.key
                          }
                          return current === session.key ? null : current
                        })
                      }}
                    />
                  </div>
                )
              })}
            </div>
          )}

          {actionError ? (
            <p className="rounded-[0.8rem] border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-sm leading-6 text-rose-700">
              {actionError}
            </p>
          ) : null}

          <div className="flex items-center justify-end gap-2 border-t border-black/6 pt-3">
            <Button
              type="button"
              variant="ghost"
              className="h-10 rounded-[0.75rem] px-4"
              disabled={!canCloseMainDialog}
              onClick={onClose}
            >
              {t('chat.session.cancel')}
            </Button>
            <Button
              type="button"
              variant="default"
              className="h-10 rounded-[0.75rem] px-4"
              disabled={!canConfirm}
              onClick={onConfirm}
            >
              {t('chat.session.confirmSwitch')}
            </Button>
          </div>
        </div>
      </DialogShell>

      {renameTarget ? (
        <DialogShell
          title={t('chat.session.renameTitle')}
          onClose={closeRenameDialog}
          maxWidthClassName="max-w-[calc(100vw-1.5rem)] sm:max-w-[25rem]"
        >
          <div className="space-y-4">
            <div className="space-y-2">
              <label
                htmlFor="home-rename-session-name"
                className="text-sm font-medium text-foreground"
              >
                {t('chat.session.renameLabel')}
              </label>
              <Input
                id="home-rename-session-name"
                density="sm"
                maxLength={64}
                value={renameDraft}
                onChange={(event) => setRenameDraft(event.target.value)}
                placeholder={t('chat.session.renamePlaceholder')}
              />
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-black/6 pt-3">
              <Button
                type="button"
                variant="ghost"
                className="h-10 rounded-[0.75rem] px-4"
                disabled={actionPending !== null}
                onClick={closeRenameDialog}
              >
                {t('chat.session.cancel')}
              </Button>
              <Button
                type="button"
                variant="default"
                className="h-10 rounded-[0.75rem] px-4"
                disabled={!renameDraft.trim() || actionPending !== null}
                onClick={() => {
                  if (!renameTarget || actionPending) {
                    return
                  }

                  setActionPending('rename')
                  setActionError(null)
                  void onRenameSession(renameTarget.key, renameDraft.trim())
                    .then(() => {
                      setRenameTargetSessionKey(null)
                      setRenameDraft('')
                    })
                    .catch((renameError: unknown) => {
                      setActionError(
                        renameError instanceof Error ? renameError.message : t('chat.session.renameFailed')
                      )
                    })
                    .finally(() => {
                      setActionPending(null)
                    })
                }}
              >
                {actionPending === 'rename' ? <Loader2 className="size-4 animate-spin" /> : null}
                {t('chat.session.save')}
              </Button>
            </div>
          </div>
        </DialogShell>
      ) : null}

      {deleteTarget ? (
        <DialogShell
          title={t('chat.session.deleteTitle')}
          onClose={closeDeleteDialog}
          maxWidthClassName="max-w-[calc(100vw-1.5rem)] sm:max-w-[25rem]"
        >
          <div className="space-y-4">
            <div className="space-y-2 text-sm leading-6 text-foreground/88">
              <p>
                {t('chat.session.deleteConfirmPrefix')}
                <span className="font-medium text-foreground">
                  {getGatewaySessionTitle(deleteTarget)}
                </span>
                {t('chat.session.deleteConfirmSuffix')}
              </p>
              {isSameGatewaySessionKey(deleteTarget.key, currentSessionKey) ? (
                <p className="text-muted-foreground">{t('chat.session.deleteCurrentHint')}</p>
              ) : null}
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-black/6 pt-3">
              <Button
                type="button"
                variant="ghost"
                className="h-10 rounded-[0.75rem] px-4"
                disabled={actionPending !== null}
                onClick={closeDeleteDialog}
              >
                {t('chat.session.cancel')}
              </Button>
              <Button
                type="button"
                className="h-10 rounded-[0.75rem] bg-rose-600 px-4 text-white hover:bg-rose-600/90"
                disabled={actionPending !== null}
                onClick={() => {
                  if (!deleteTarget || actionPending) {
                    return
                  }

                  setActionPending('delete')
                  setActionError(null)
                  void onDeleteSession(deleteTarget.key)
                    .then(() => {
                      setDeleteTargetSessionKey(null)
                    })
                    .catch((deleteError: unknown) => {
                      setActionError(
                        deleteError instanceof Error ? deleteError.message : t('chat.session.deleteFailed')
                      )
                    })
                    .finally(() => {
                      setActionPending(null)
                    })
                }}
              >
                {actionPending === 'delete' ? <Loader2 className="size-4 animate-spin" /> : null}
                {t('chat.session.deleteConfirmButton')}
              </Button>
            </div>
          </div>
        </DialogShell>
      ) : null}
    </>
  )
}

export default SessionSwitchDialog
