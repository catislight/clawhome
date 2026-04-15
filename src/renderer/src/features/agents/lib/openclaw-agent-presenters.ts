import { translateWithAppLanguage } from '@/shared/i18n/app-i18n'

type OpenClawAgentIdentityLike = {
  name?: string
  emoji?: string
}

type OpenClawAgentSummaryLike = {
  id: string
  name?: string
  identity?: OpenClawAgentIdentityLike
}

export function resolveOpenClawAgentDisplayName(agent: OpenClawAgentSummaryLike): string {
  return (
    agent.name?.trim() ||
    agent.identity?.name?.trim() ||
    agent.id.trim() ||
    translateWithAppLanguage('agents.presenter.unnamed')
  )
}

export function resolveOpenClawAgentEmoji(
  agent: { identity?: OpenClawAgentIdentityLike },
  fallback = '🤖'
): string {
  return agent.identity?.emoji?.trim() || fallback
}
