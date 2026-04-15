import { Navigate, Route, Routes } from 'react-router-dom'

import AgentsCenterPage from '@/features/agents/pages/agents-center-page'
import AgentsConfigPage from '@/features/agents/pages/agents-config-page'
import AgentsDefaultsConfigPage from '@/features/agents/pages/agents-defaults-config-page'
import ConfigPage from '@/features/instances/pages/config-page'
import HomePage from '@/features/chat/pages/home-page'
import OpenClawCronPage from '@/features/cron/pages/openclaw-cron-page'
import OpenClawCronTranscriptPage from '@/features/cron/pages/openclaw-cron-transcript-page'
import KnowledgeBasePage from '@/features/knowledge-base/pages/knowledge-base-page'
import OpenClawLogsPage from '@/features/logs/pages/openclaw-logs-page'
import PreferencesPage from '@/features/preferences/pages/preferences-page'
import SettingsCenterPage from '@/features/settings/pages/settings-center-page'
import SkillsCenterPage from '@/features/skills/pages/skills-center-page'
import OpenClawTerminalPage from '@/features/terminal/pages/openclaw-terminal-page'

function AppRouter(): React.JSX.Element {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/knowledge-base" element={<KnowledgeBasePage />} />
      <Route path="/cron" element={<OpenClawCronPage />} />
      <Route path="/logs" element={<OpenClawLogsPage />} />
      <Route path="/skills" element={<SkillsCenterPage />} />
      <Route path="/agents" element={<AgentsCenterPage />} />
      <Route path="/agents/defaults" element={<AgentsDefaultsConfigPage />} />
      <Route path="/agents/:agentId" element={<AgentsConfigPage />} />
      <Route path="/preferences" element={<PreferencesPage />} />
      <Route path="/settings-center" element={<SettingsCenterPage />} />
      <Route path="/cron/transcript" element={<OpenClawCronTranscriptPage />} />
      <Route path="/terminal" element={<OpenClawTerminalPage />} />
      <Route path="/config" element={<ConfigPage />} />
      <Route path="*" element={<Navigate replace to="/" />} />
    </Routes>
  )
}

export default AppRouter
