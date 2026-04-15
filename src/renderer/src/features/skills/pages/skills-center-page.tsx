import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import AppShellContentArea from '@/shared/layout/app-shell-content-area'
import AppShellSplitWorkspace from '@/shared/layout/app-shell-split-workspace'
import OpenClawSkillContentPanel from '@/features/skills/components/openclaw-skill-content-panel'
import OpenClawSkillCreateDialog from '@/features/skills/components/openclaw-skill-create-dialog'
import OpenClawSkillsSidebar from '@/features/skills/components/openclaw-skills-sidebar'
import OpenClawConnectionStatePanel from '@/features/instances/components/openclaw-connection-state-panel'
import OpenClawNoInstanceState from '@/features/instances/components/openclaw-no-instance-state'
import { useOpenClawConnectionActions } from '@/features/instances/lib/use-openclaw-connection-actions'
import { useOpenClawSkillsCenter } from '@/features/skills/lib/use-openclaw-skills-center'
import { useWorkspaceInstanceSelection } from '@/features/instances/lib/use-workspace-instance-selection'
import { useAppStore } from '@/features/instances/store/use-app-store'
import { useAppI18n } from '@/shared/i18n/app-i18n'

function SkillsCenterPage(): React.JSX.Element {
  const { t } = useAppI18n()
  const navigate = useNavigate()
  const instances = useAppStore((state) => state.instances)
  const { connectInstance } = useOpenClawConnectionActions()
  const { selectedInstance } = useWorkspaceInstanceSelection()
  const [reconnectingInstanceId, setReconnectingInstanceId] = useState<string | null>(null)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [createDialogVersion, setCreateDialogVersion] = useState(0)
  const [createDialogError, setCreateDialogError] = useState<string | null>(null)

  const selectedInstanceConnected = selectedInstance?.connectionState === 'connected'
  const selectedInstanceRequiresConnectionConfig =
    selectedInstance && selectedInstance.connectionConfig === null

  const skillsCenter = useOpenClawSkillsCenter({
    instanceId: selectedInstanceConnected ? selectedInstance.id : null,
    connectionConfig: selectedInstanceConnected ? selectedInstance.connectionConfig : null,
    enabled: selectedInstanceConnected
  })

  return (
    <AppShellContentArea
      disableInnerPadding
      contentScrollable={false}
      innerClassName="h-full min-h-0 gap-0"
    >
      {instances.length === 0 ? (
        <OpenClawNoInstanceState
          message={t('skills.page.noInstance')}
          onOpenConfig={() => navigate('/config')}
        />
      ) : !selectedInstance ? null : selectedInstanceRequiresConnectionConfig ||
        !selectedInstanceConnected ? (
        <OpenClawConnectionStatePanel
          instance={selectedInstance}
          reconnectPending={reconnectingInstanceId === selectedInstance.id}
          descriptionOverride={t('skills.page.needConnectionDescription')}
          onReconnect={(instance) => {
            setReconnectingInstanceId(instance.id)
            void connectInstance(instance, {
              optimisticConnecting: false
            }).finally(() => {
              setReconnectingInstanceId((current) => (current === instance.id ? null : current))
            })
          }}
          onOpenConfig={() => navigate('/config')}
        />
      ) : (
        <AppShellSplitWorkspace
          sidebar={
            <OpenClawSkillsSidebar
              loading={skillsCenter.loading}
              category={skillsCenter.activeCategory}
              skills={skillsCenter.visibleSkills}
              selectedSkillKey={skillsCenter.selectedSkillKey}
              creatingSkill={skillsCenter.creatingSkill}
              onCategoryChange={skillsCenter.setActiveCategory}
              onSelectSkill={skillsCenter.selectSkill}
              onCreateSkill={() => {
                setCreateDialogError(null)
                setCreateDialogVersion((current) => current + 1)
                setCreateDialogOpen(true)
              }}
            />
          }
        >
          <OpenClawSkillContentPanel
            loading={skillsCenter.loading}
            skill={skillsCenter.selectedSkill}
            loadingContent={skillsCenter.loadingContent}
            savingContent={skillsCenter.savingContent}
            updatingEnabled={skillsCenter.updatingEnabled}
            deletingSkill={skillsCenter.deletingSkill}
            draftContent={skillsCenter.selectedSkillContentDraft}
            dirty={skillsCenter.selectedSkillContentDirty}
            error={skillsCenter.error}
            onDraftChange={skillsCenter.updateSelectedSkillContentDraft}
            onReload={() => {
              void skillsCenter.reloadSelectedSkillContent()
            }}
            onReset={skillsCenter.resetSelectedSkillContentDraft}
            onSave={() => {
              void skillsCenter.saveSelectedSkillContent()
            }}
            onToggleEnabled={(enabled) => {
              void skillsCenter.setSelectedSkillEnabled(enabled)
            }}
            onDeleteCustomSkill={() => {
              const targetSkill = skillsCenter.selectedSkill
              if (!targetSkill || targetSkill.bundled) {
                return
              }

              const confirmed = window.confirm(
                t('skills.page.confirmDeleteCustom', { name: targetSkill.name })
              )
              if (!confirmed) {
                return
              }

              void skillsCenter.deleteSelectedCustomSkill()
            }}
          />
        </AppShellSplitWorkspace>
      )}

      <OpenClawSkillCreateDialog
        key={createDialogVersion}
        open={createDialogOpen}
        submitting={skillsCenter.creatingSkill}
        error={createDialogError}
        onClose={() => {
          if (skillsCenter.creatingSkill) {
            return
          }
          setCreateDialogOpen(false)
        }}
        onCreate={(name) => {
          setCreateDialogError(null)
          void skillsCenter
            .createCustomSkill(name)
            .then(() => {
              setCreateDialogOpen(false)
            })
            .catch((createError) => {
              setCreateDialogError(
                createError instanceof Error ? createError.message : t('skills.page.createFailed')
              )
            })
        }}
      />
    </AppShellContentArea>
  )
}

export default SkillsCenterPage
