import { Loader2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

import OpenClawAgentCreateDialog from '@/features/agents/components/openclaw-agent-create-dialog'
import OpenClawAgentFilesTab from '@/features/agents/components/openclaw-agent-files-tab'
import OpenClawAgentMemoryTab from '@/features/agents/components/openclaw-agent-memory-tab'
import OpenClawAgentParamsDialog from '@/features/agents/components/openclaw-agent-params-dialog'
import OpenClawAgentSettingsTab from '@/features/agents/components/openclaw-agent-settings-tab'
import OpenClawAgentSkillsTab from '@/features/agents/components/openclaw-agent-skills-tab'
import OpenClawAgentTabBar from '@/features/agents/components/openclaw-agent-tab-bar'
import OpenClawAgentToolsTab from '@/features/agents/components/openclaw-agent-tools-tab'
import OpenClawAgentsSidebar from '@/features/agents/components/openclaw-agents-sidebar'
import { useAgentsCenterPageController } from '@/features/agents/lib/use-agents-center-page-controller'
import OpenClawConnectionStatePanel from '@/features/instances/components/openclaw-connection-state-panel'
import OpenClawNoInstanceState from '@/features/instances/components/openclaw-no-instance-state'
import { useAppI18n } from '@/shared/i18n/app-i18n'
import AppShellContentArea from '@/shared/layout/app-shell-content-area'
import AppShellSplitWorkspace from '@/shared/layout/app-shell-split-workspace'
import { Button } from '@/shared/ui/button'

type AgentsCenterPageProps = {
  preferredAgentId?: string | null
}

function AgentsCenterPage({ preferredAgentId }: AgentsCenterPageProps): React.JSX.Element {
  const navigate = useNavigate()
  const { t } = useAppI18n()

  const {
    instances,
    selectedInstance,
    selectedInstanceConnected,
    selectedInstanceRequiresConnectionConfig,
    reconnectingInstanceId,
    reconnectSelectedInstance,
    activeTab,
    setActiveTab,
    agentsList,
    selectedAgentId,
    selectedAgent,
    selectedAgentDisplayName,
    defaultAgentId,
    agentsLoading,
    agentsError,
    agentsCreating,
    selectAgent,
    createDialogOpen,
    createDialogError,
    openCreateDialog,
    closeCreateDialog,
    submitCreateAgent,
    personaTabProps,
    memoryTabProps,
    toolsTabProps,
    skillsTabProps,
    settingsTabProps,
    paramsDialogOpen,
    paramsDialogError,
    paramsDialogInitialValue,
    closeParamsDialog,
    submitParamsDialog
  } = useAgentsCenterPageController({ preferredAgentId })

  return (
    <AppShellContentArea
      disableInnerPadding
      contentScrollable={false}
      innerClassName="h-full min-h-0 gap-0"
    >
      {instances.length === 0 ? (
        <OpenClawNoInstanceState
          message={t('agents.page.noInstance')}
          onOpenConfig={() => navigate('/config')}
        />
      ) : !selectedInstance ? null : selectedInstanceRequiresConnectionConfig ||
        !selectedInstanceConnected ? (
        <OpenClawConnectionStatePanel
          instance={selectedInstance}
          reconnectPending={reconnectingInstanceId === selectedInstance.id}
          descriptionOverride={t('agents.page.needConnectionDescription')}
          onReconnect={(instance) => {
            void reconnectSelectedInstance(instance)
          }}
          onOpenConfig={() => navigate('/config')}
        />
      ) : (
        <AppShellSplitWorkspace
          sidebar={
            <OpenClawAgentsSidebar
              agents={agentsList}
              selectedAgentId={selectedAgentId}
              defaultAgentId={defaultAgentId}
              connectionConfig={selectedInstance.connectionConfig}
              loading={agentsLoading && agentsList.length === 0}
              error={agentsError}
              creating={agentsCreating}
              onSelectAgent={selectAgent}
              onCreateAgent={openCreateDialog}
            />
          }
          contentHeader={
            selectedAgent ? (
              <div className="flex w-full min-w-0 items-center justify-between gap-3">
                <h2 className="min-w-0 truncate text-sm font-semibold tracking-tight text-foreground">
                  {selectedAgentDisplayName}
                </h2>
                <OpenClawAgentTabBar activeTab={activeTab} onChange={setActiveTab} />
              </div>
            ) : null
          }
          contentBodyClassName="flex min-h-0 flex-1 flex-col"
        >
          {agentsLoading && agentsList.length === 0 ? (
            <section className="flex h-full min-h-0 items-center justify-center">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                {t('agents.page.loadingAgents')}
              </div>
            </section>
          ) : agentsList.length === 0 ? (
            <section className="flex h-full min-h-0 flex-col items-center justify-center px-6 text-center">
              <h3 className="text-xl font-semibold tracking-tight text-foreground">{t('agents.page.emptyTitle')}</h3>
              <p className="mt-3 text-sm text-muted-foreground">
                {t('agents.page.emptyDescription')}
              </p>
              <Button
                type="button"
                className="mt-6 h-9 rounded-xl px-4 text-sm"
                onClick={openCreateDialog}
              >
                {t('agents.page.create')}
              </Button>
            </section>
          ) : !selectedAgent ? (
            <section className="flex h-full min-h-0 items-center justify-center px-6 text-sm text-muted-foreground">
              {t('agents.page.selectAgent')}
            </section>
          ) : activeTab === 'persona' ? (
            <OpenClawAgentFilesTab {...personaTabProps} />
          ) : activeTab === 'memory' ? (
            <OpenClawAgentMemoryTab {...memoryTabProps} />
          ) : activeTab === 'tools' ? (
            <OpenClawAgentToolsTab {...toolsTabProps} />
          ) : activeTab === 'skills' ? (
            <OpenClawAgentSkillsTab {...skillsTabProps} />
          ) : (
            <OpenClawAgentSettingsTab {...settingsTabProps} />
          )}
        </AppShellSplitWorkspace>
      )}

      <OpenClawAgentCreateDialog
        open={createDialogOpen}
        submitting={agentsCreating}
        error={createDialogError}
        connectionConfig={selectedInstance?.connectionConfig ?? null}
        onClose={closeCreateDialog}
        onCreate={(payload) => {
          void submitCreateAgent(payload)
        }}
      />

      <OpenClawAgentParamsDialog
        open={paramsDialogOpen}
        initialValue={paramsDialogInitialValue}
        error={paramsDialogError}
        onClose={closeParamsDialog}
        onSubmit={submitParamsDialog}
      />
    </AppShellContentArea>
  )
}

export default AgentsCenterPage
