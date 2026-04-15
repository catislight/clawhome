import { useParams } from 'react-router-dom'

import AgentsCenterPage from '@/features/agents/pages/agents-center-page'

function AgentsConfigPage(): React.JSX.Element {
  const { agentId } = useParams<{ agentId: string }>()
  return <AgentsCenterPage preferredAgentId={agentId ?? null} />
}

export default AgentsConfigPage
