import { Loader2, Plus } from 'lucide-react'

import OpenClawAgentAvatar from '@/features/agents/components/openclaw-agent-avatar'
import {
  resolveOpenClawAgentDisplayName,
  resolveOpenClawAgentEmoji
} from '@/features/agents/lib/openclaw-agent-presenters'
import type { OpenClawAgentSummary } from '@/features/agents/lib/openclaw-agents-types'
import type { SshConnectionFormValues } from '@/features/instances/model/ssh-connection'
import { useAppI18n } from '@/shared/i18n/app-i18n'
import { cn } from '@/shared/lib/utils'
import { Button } from '@/shared/ui/button'

type OpenClawAgentsSidebarProps = {
  agents: OpenClawAgentSummary[]
  selectedAgentId: string | null
  defaultAgentId?: string | null
  connectionConfig?: SshConnectionFormValues | null
  loading?: boolean
  error?: string | null
  creating?: boolean
  onSelectAgent: (agentId: string) => void
  onCreateAgent: () => void
}

function OpenClawAgentsSidebar({
  agents,
  selectedAgentId,
  defaultAgentId,
  connectionConfig = null,
  loading = false,
  error,
  creating = false,
  onSelectAgent,
  onCreateAgent
}: OpenClawAgentsSidebarProps): React.JSX.Element {
  const { t } = useAppI18n()

  return (
    <aside className="flex h-full min-h-0 w-[280px] shrink-0 flex-col border-r border-black/6 bg-[#FBFCFF]">
      <header className="flex h-[52px] shrink-0 items-center justify-between border-b border-black/6 px-3">
        <div className="flex min-w-0 items-baseline gap-1.5">
          <p className="truncate text-sm font-semibold tracking-tight text-foreground">{t('agents.sidebar.title')}</p>
          <p className="shrink-0 translate-y-[1px] text-[11px] text-muted-foreground">
            {t('agents.sidebar.count', { count: agents.length })}
          </p>
        </div>

        <Button
          type="button"
          size="icon"
          className="size-8 rounded-[0.7rem]"
          aria-label={t('agents.sidebar.create')}
          title={t('agents.sidebar.create')}
          disabled={creating}
          onClick={onCreateAgent}
        >
          {creating ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
        </Button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {error ? (
          <div className="mb-2 rounded-[0.7rem] border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
            {error}
          </div>
        ) : null}

        {loading ? (
          <div className="flex h-full min-h-[180px] items-center justify-center">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin" />
              {t('agents.sidebar.loading')}
            </div>
          </div>
        ) : agents.length === 0 ? (
          <div className="rounded-[0.7rem] bg-white px-3 py-2.5 text-xs text-muted-foreground">
            {t('agents.sidebar.empty')}
          </div>
        ) : (
          <div>
            {agents.map((agent) => {
              const selected = selectedAgentId === agent.id
              const displayName = resolveOpenClawAgentDisplayName(agent)
              const avatarEmoji = resolveOpenClawAgentEmoji(agent)
              const avatarValue = agent.identity?.avatarUrl?.trim() || agent.identity?.avatar?.trim()
              const isDefault = agent.id === defaultAgentId

              return (
                <button
                  key={agent.id}
                  type="button"
                  aria-pressed={selected}
                  className={cn(
                    'flex w-full items-center gap-2.5 rounded-[0.75rem] px-2.5 py-1.5 text-left transition-colors',
                    selected ? 'bg-primary/10' : 'hover:bg-white'
                  )}
                  onClick={() => onSelectAgent(agent.id)}
                >
                  <OpenClawAgentAvatar
                    label={t('agents.sidebar.avatarLabel', { name: displayName })}
                    emoji={avatarEmoji}
                    avatar={avatarValue}
                    workspacePath={agent.workspace}
                    connectionConfig={connectionConfig}
                    className="size-8 shrink-0 rounded-[0.7rem] bg-primary/10 text-sm"
                  />

                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      <span className="truncate text-sm font-medium text-foreground">
                        {displayName}
                      </span>
                      {isDefault ? (
                        <span className="shrink-0 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary">
                          {t('agents.sidebar.defaultTag')}
                        </span>
                      ) : null}
                    </span>
                  </span>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </aside>
  )
}

export default OpenClawAgentsSidebar
