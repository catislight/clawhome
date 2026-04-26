import { Navigate, Route, Routes, useLocation } from 'react-router-dom'

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
import KeepAlive from '@/shared/layout/keep-alive'

function AppRouter(): React.JSX.Element {
  const location = useLocation()
  const homeActive = location.pathname === '/'

  return (
    <>
      <KeepAlive cacheKey="route:home" active={homeActive} maxEntries={2}>
        <HomePage />
      </KeepAlive>

      <div className={homeActive ? 'hidden' : 'flex min-h-0 flex-1'}>
        <Routes>
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
      </div>
    </>
  )
}

export default AppRouter
