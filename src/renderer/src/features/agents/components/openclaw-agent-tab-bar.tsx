import { OPENCLAW_AGENT_TAB_ITEMS } from '@/features/agents/lib/openclaw-agents-center-constants'
import type { OpenClawAgentTabId } from '@/features/agents/lib/openclaw-agents-center-types'
import { useAppI18n } from '@/shared/i18n/app-i18n'
import { cn } from '@/shared/lib/utils'

type OpenClawAgentTabBarProps = {
  activeTab: OpenClawAgentTabId
  onChange: (tab: OpenClawAgentTabId) => void
}

function OpenClawAgentTabBar({ activeTab, onChange }: OpenClawAgentTabBarProps): React.JSX.Element {
  const { t } = useAppI18n()
  const resolveTabLabel = (tabId: OpenClawAgentTabId): string => {
    if (tabId === 'persona') {
      return t('agents.tabs.persona')
    }
    if (tabId === 'memory') {
      return t('agents.tabs.memory')
    }
    if (tabId === 'tools') {
      return t('agents.tabs.tools')
    }
    if (tabId === 'skills') {
      return t('agents.tabs.skills')
    }
    return t('agents.tabs.settings')
  }

  return (
    <div className="flex h-full items-center gap-1.5" role="tablist" aria-label={t('agents.tabs.aria')}>
      {OPENCLAW_AGENT_TAB_ITEMS.map((tabId) => (
        <button
          key={tabId}
          type="button"
          role="tab"
          aria-selected={activeTab === tabId}
          className={cn(
            'h-8 rounded-[0.65rem] px-3 text-xs font-medium transition-colors',
            activeTab === tabId
              ? 'bg-primary/10 text-foreground'
              : 'text-muted-foreground hover:bg-black/4 hover:text-foreground'
          )}
          onClick={() => onChange(tabId)}
        >
          {resolveTabLabel(tabId)}
        </button>
      ))}
    </div>
  )
}

export default OpenClawAgentTabBar
