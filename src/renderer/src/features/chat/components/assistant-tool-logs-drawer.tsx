import { X } from 'lucide-react'

import type { ConversationRunTrace } from '@/features/chat/lib/gateway-run-trace'
import { useAppI18n } from '@/shared/i18n/app-i18n'
import { Button } from '@/shared/ui/button'

type AssistantToolLogsDrawerProps = {
  open: boolean
  onClose: () => void
  toolLogs: ConversationRunTrace['toolLogs']
}

const EXEC_TOOL_LOG_TITLE = 'exec'

function isExecStartPhaseToolLog(title: string): boolean {
  return title.trim().toLowerCase() === EXEC_TOOL_LOG_TITLE
}

function normalizeCommandValue(value: string): string | null {
  const normalized = value.trim()
  if (!normalized) {
    return null
  }

  const inlineCommandMatches = Array.from(normalized.matchAll(/`([^`]+)`/g))
    .map((match) => match[1]?.trim() ?? '')
    .filter((segment) => segment.length > 0)

  if (inlineCommandMatches.length > 0) {
    return inlineCommandMatches.at(-1) ?? null
  }

  return normalized
}

function resolveToolCommand(content: string): string | null {
  const normalized = content.trim()
  if (!normalized) {
    return null
  }

  const isLikelyJson =
    (normalized.startsWith('{') && normalized.endsWith('}')) ||
    (normalized.startsWith('[') && normalized.endsWith(']'))

  if (isLikelyJson) {
    try {
      const parsed = JSON.parse(normalized)
      if (typeof parsed === 'object' && parsed !== null && 'command' in parsed) {
        const commandValue = (parsed as Record<string, unknown>).command
        if (typeof commandValue === 'string') {
          return normalizeCommandValue(commandValue)
        }

        if (typeof commandValue === 'number' || typeof commandValue === 'boolean') {
          return String(commandValue)
        }
      }
    } catch {
      return null
    }

    return null
  }

  return normalizeCommandValue(normalized)
}

function AssistantToolLogsDrawer({
  open,
  onClose,
  toolLogs
}: AssistantToolLogsDrawerProps): React.JSX.Element | null {
  const { t } = useAppI18n()
  const execToolLogs = toolLogs.filter((log) => isExecStartPhaseToolLog(log.title))

  if (!open) {
    return null
  }

  return (
    <div
      aria-hidden={false}
      className="fixed inset-0 z-50 flex justify-end bg-slate-950/25 backdrop-blur-[2px]"
      onMouseDown={(event) => {
        if (event.target !== event.currentTarget) {
          return
        }

        onClose()
      }}
      role="presentation"
    >
      <aside
        aria-label={t('chat.toolLogs.title')}
        aria-modal="true"
        className="flex h-full w-full max-w-[min(48vw,34rem)] min-w-[20rem] flex-col border-l border-black/10 bg-card shadow-[-18px_0_46px_-30px_rgba(15,23,42,0.38)]"
        role="dialog"
      >
        <header className="flex items-center justify-between border-b border-black/6 px-4 py-3.5">
          <h2 className="text-base font-semibold text-foreground">{t('chat.toolLogs.title')}</h2>

          <Button
            aria-label={t('chat.toolLogs.close')}
            className="size-8 rounded-[0.7rem] border border-transparent text-muted-foreground hover:border-black/6 hover:bg-secondary hover:text-foreground"
            size="icon"
            type="button"
            variant="ghost"
            onClick={onClose}
          >
            <X className="size-4" />
          </Button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          {execToolLogs.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('chat.toolLogs.empty')}</p>
          ) : (
            <ul className="divide-y divide-black/6">
              {execToolLogs.map((log) => {
                const command = resolveToolCommand(log.content)

                return (
                  <li key={log.id} className="py-3">
                    {command ? (
                      <pre className="overflow-x-auto whitespace-pre-wrap break-words rounded-[0.65rem] bg-[#F7F9FC] px-2.5 py-2 text-xs leading-5 text-[#3E4A5A]">
                        {command}
                      </pre>
                    ) : (
                      <p className="rounded-[0.65rem] bg-[#F7F9FC] px-2.5 py-2 text-xs leading-5 text-muted-foreground">
                        {t('chat.toolLogs.emptyContent')}
                      </p>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </aside>
    </div>
  )
}

export default AssistantToolLogsDrawer
