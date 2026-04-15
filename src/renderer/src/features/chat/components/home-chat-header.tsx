import { Loader2 } from 'lucide-react'

import OpenClawAgentAvatar from '@/features/agents/components/openclaw-agent-avatar'
import type { SshConnectionFormValues } from '@/features/instances/model/ssh-connection'
import { useAppI18n } from '@/shared/i18n/app-i18n'
import { OverflowMenu } from '@/shared/ui/overflow-menu'
import { cn } from '@/shared/lib/utils'

export type HomeChatHeaderAgentItem = {
  id: string
  label: string
  emoji?: string
  avatar?: string
  workspacePath?: string
}

type HomeChatHeaderProps = {
  selectedAgentId: string | null
  agentItems: HomeChatHeaderAgentItem[]
  connectionConfig?: SshConnectionFormValues | null
  agentsLoading: boolean
  activeInstanceConnected: boolean
  canCreateNewConversation: boolean
  onSelectAgent: (agentId: string) => void
  onOpenSessionDialog: () => void
  onOpenNewSessionDialog: () => void
}

function HomeChatHeader({
  selectedAgentId,
  agentItems,
  connectionConfig = null,
  agentsLoading,
  activeInstanceConnected,
  canCreateNewConversation,
  onSelectAgent,
  onOpenSessionDialog,
  onOpenNewSessionDialog
}: HomeChatHeaderProps): React.JSX.Element {
  const { t } = useAppI18n()
  const controlsDisabled = agentsLoading || !activeInstanceConnected

  return (
    <div className="flex w-full items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2">
        <div
          className={cn(
            'flex items-center gap-1 rounded-full border border-black/[0.06] bg-white px-1 py-0.5',
            controlsDisabled && 'opacity-70'
          )}
          aria-label={t('chat.homeHeader.ariaSwitchAgent')}
          role="group"
        >
          {agentsLoading ? (
            <span className="flex h-7 items-center px-2 text-xs text-muted-foreground">
              <Loader2 className="mr-1.5 size-3.5 animate-spin" />
              {t('chat.homeHeader.loading')}
            </span>
          ) : agentItems.length === 0 ? (
            <span className="px-2 text-xs text-muted-foreground">{t('chat.homeHeader.noAgents')}</span>
          ) : (
            agentItems.map((agent) => {
              const selected = selectedAgentId === agent.id

              return (
                <button
                  key={agent.id}
                  type="button"
                  aria-label={t('chat.homeHeader.ariaSwitchToAgent', { agent: agent.label })}
                  aria-pressed={selected}
                  title={agent.label}
                  disabled={controlsDisabled}
                  className={cn(
                    'relative flex size-7 items-center justify-center overflow-hidden rounded-full border text-sm transition-all',
                    selected
                      ? 'border-primary/30 bg-primary/12 text-primary shadow-[0_8px_18px_-14px_rgba(37,99,235,0.65)]'
                      : 'border-transparent bg-transparent text-muted-foreground hover:-translate-y-[1px] hover:border-black/10 hover:bg-black/[0.03] hover:text-foreground'
                  )}
                  onClick={() => {
                    onSelectAgent(agent.id)
                  }}
                >
                  <OpenClawAgentAvatar
                    label={agent.label}
                    emoji={agent.emoji}
                    avatar={agent.avatar}
                    workspacePath={agent.workspacePath}
                    connectionConfig={connectionConfig}
                    className="size-full border-0 bg-transparent"
                  />
                </button>
              )
            })
          )}
        </div>
      </div>

      <div>
        <OverflowMenu
          items={[
            {
              key: 'switch-session',
              label: t('chat.homeHeader.switchSession'),
              onSelect: onOpenSessionDialog,
              disabled: !activeInstanceConnected
            },
            {
              key: 'create-session',
              label: t('chat.homeHeader.createSession'),
              onSelect: onOpenNewSessionDialog,
              disabled: !activeInstanceConnected || !canCreateNewConversation
            }
          ]}
          triggerLabel={t('chat.homeHeader.moreActions')}
          triggerClassName="size-9 rounded-[0.75rem] text-muted-foreground hover:bg-secondary hover:text-foreground"
        />
      </div>
    </div>
  )
}

export default HomeChatHeader
