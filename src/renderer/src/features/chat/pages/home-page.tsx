import { useCallback, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import openclawLogo from '../../../../../../resources/logo.png'

import ChatComposer from '@/features/chat/components/chat-composer'
import ChatModelSelector from '@/features/chat/components/chat-model-selector'
import ChatTranscript from '@/features/chat/components/chat-transcript'
import HomeChatHeader from '@/features/chat/components/home-chat-header'
import type { HomeChatHeaderAgentItem } from '@/features/chat/components/home-chat-header'
import NewSessionDialog from '@/features/chat/components/new-session-dialog'
import { buildOpenClawAgentMainSessionKey } from '@/features/agents/lib/openclaw-agents-types'
import {
  resolveOpenClawAgentDisplayName,
  resolveOpenClawAgentEmoji
} from '@/features/agents/lib/openclaw-agent-presenters'
import { useResolvedAgentAvatarSource } from '@/features/agents/lib/openclaw-agent-avatar-image'
import { useOpenClawAgents } from '@/features/agents/lib/use-openclaw-agents'
import { DEFAULT_CHAT_SESSION_KEY, isSameGatewaySessionKey } from '@/features/chat/lib/gateway-chat'
import { getAgentIdFromSessionKey } from '@/features/chat/lib/session-scope'
import type { ChatSubmitPayload } from '@/features/chat/lib/chat-send-types'
import AppShellContentArea from '@/shared/layout/app-shell-content-area'
import SessionSwitchDialog from '@/features/chat/components/session-switch-dialog'
import { useGatewayConversation } from '@/features/chat/lib/use-gateway-conversation'
import { useChatModelSelector } from '@/features/chat/lib/use-chat-model-selector'
import { useHomeChatSessions } from '@/features/chat/lib/use-home-chat-sessions'
import OpenClawConnectionStatePanel from '@/features/instances/components/openclaw-connection-state-panel'
import OpenClawNoInstanceState from '@/features/instances/components/openclaw-no-instance-state'
import { useOpenClawConnectionActions } from '@/features/instances/lib/use-openclaw-connection-actions'
import { useWorkspaceInstanceSelection } from '@/features/instances/lib/use-workspace-instance-selection'
import { useAppStore } from '@/features/instances/store/use-app-store'
import { formatSendKeyForDisplay, normalizeSendKey } from '@/features/preferences/lib/app-preferences'
import { useAppI18n } from '@/shared/i18n/app-i18n'

function HomePage(): React.JSX.Element {
  const { t } = useAppI18n()
  const navigate = useNavigate()
  const instances = useAppStore((state) => state.instances)
  const sendKey = useAppStore((state) => normalizeSendKey(state.preferences.sendKey))
  const { connectInstance } = useOpenClawConnectionActions()
  const { selectedInstance: activeInstance } = useWorkspaceInstanceSelection()
  const [newSessionDialogInstanceId, setNewSessionDialogInstanceId] = useState<string | null>(null)
  const [newSessionNameDraft, setNewSessionNameDraft] = useState('')
  const [sessionDialogInstanceId, setSessionDialogInstanceId] = useState<string | null>(null)
  const [reconnectingInstanceId, setReconnectingInstanceId] = useState<string | null>(null)
  const activeInstanceConnected = activeInstance?.connectionState === 'connected'
  const gatewayInstanceId = activeInstanceConnected ? (activeInstance?.id ?? null) : null
  const newSessionDialogOpen = Boolean(
    activeInstance && newSessionDialogInstanceId === activeInstance.id
  )
  const sessionDialogOpen = Boolean(activeInstance && sessionDialogInstanceId === activeInstance.id)

  const agents = useOpenClawAgents({
    instanceId: gatewayInstanceId,
    enabled: activeInstanceConnected
  })
  const agentSelectOptions = useMemo(
    () =>
      (agents.agentsList?.agents ?? []).map((agent) => ({
        value: agent.id,
        label: agent.name?.trim() || agent.id
      })),
    [agents.agentsList?.agents]
  )
  const agentHeaderItems = useMemo<HomeChatHeaderAgentItem[]>(
    () =>
      (agents.agentsList?.agents ?? []).map((agent) => {
        return {
          id: agent.id,
          label: resolveOpenClawAgentDisplayName(agent),
          emoji: resolveOpenClawAgentEmoji(agent),
          avatar: agent.identity?.avatarUrl?.trim() || agent.identity?.avatar?.trim(),
          workspacePath: agent.workspace
        }
      }),
    [agents.agentsList?.agents]
  )

  const selectedAgentId = agents.selectedAgentId?.trim() || null
  const selectedAgent = agents.selectedAgent

  const selectedAgentAvatar = useResolvedAgentAvatarSource({
    avatar: selectedAgent?.identity?.avatarUrl?.trim() || selectedAgent?.identity?.avatar?.trim(),
    workspacePath: selectedAgent?.workspace,
    connectionConfig: activeInstance?.connectionConfig ?? null
  })

  const assistantAvatar = useMemo(() => {
    const fallback = {
      label: t('chat.avatar.agent'),
      emoji: '🤖'
    }

    if (!selectedAgent) {
      return fallback
    }

    const emoji = selectedAgent.identity?.emoji?.trim()
    const agentName = selectedAgent.name?.trim() || selectedAgent.id

    return {
      label: t('chat.avatar.agentNamed', { name: agentName }),
      emoji: emoji || (selectedAgentAvatar ? undefined : '🤖'),
      imageSrc: selectedAgentAvatar
    }
  }, [selectedAgent, selectedAgentAvatar, t])

  const userAvatar = useMemo(
    () => ({
      label: 'ClawHome Logo',
      imageSrc: openclawLogo
    }),
    []
  )

  const agentMainSessionKey = useMemo(() => {
    if (!selectedAgentId) {
      return null
    }

    return buildOpenClawAgentMainSessionKey(selectedAgentId, agents.mainSessionKey)
  }, [selectedAgentId, agents.mainSessionKey])

  const {
    activeSessionKey,
    pendingSessionKey,
    sessionDialogSessions,
    sessionDialogLoading,
    sessionDialogError,
    setPendingSessionKey,
    createConversation,
    loadSessionOptions,
    renameConversation,
    deleteConversation,
    confirmSessionSwitch,
    resetSessionDialogState
  } = useHomeChatSessions({
    activeInstanceId: activeInstance?.id ?? null
  })

  const resolvedSessionKey = useMemo(() => {
    if (!selectedAgentId) {
      return activeSessionKey
    }

    const activeSessionAgentId = getAgentIdFromSessionKey(activeSessionKey)
    const normalizedSelectedAgentId = selectedAgentId.trim().toLowerCase()

    if (activeSessionAgentId === normalizedSelectedAgentId) {
      return activeSessionKey
    }

    return agentMainSessionKey ?? activeSessionKey
  }, [activeSessionKey, agentMainSessionKey, selectedAgentId])
  const chatModelSelector = useChatModelSelector({
    instanceId: gatewayInstanceId,
    sessionKey: resolvedSessionKey,
    enabled: activeInstanceConnected
  })

  const {
    messages,
    messageTraces,
    showHistoryLoadingState,
    historyError,
    submitting,
    canResetConversation: canCreateConversation,
    sendMessage
  } = useGatewayConversation({
    instanceId: gatewayInstanceId,
    enabled: activeInstanceConnected,
    sessionKey: resolvedSessionKey
  })
  const canCreateNewConversation = canCreateConversation && !showHistoryLoadingState
  const composerSendShortcuts = useMemo(() => [sendKey], [sendKey])
  const sendShortcutHint = useMemo(
    () => `${formatSendKeyForDisplay(sendKey)} ${t('chat.shortcut.send')}`,
    [sendKey, t]
  )

  const handleSubmitMessage = useCallback(
    async (payload: ChatSubmitPayload): Promise<void> => {
      await sendMessage(payload.message, {
        model: chatModelSelector.modelOverride,
        images: payload.images,
        userTags: payload.tags,
        connectionConfig: activeInstance?.connectionConfig
      })
    },
    [activeInstance?.connectionConfig, chatModelSelector.modelOverride, sendMessage]
  )

  const handleOpenNewSessionDialog = (): void => {
    if (!activeInstance) {
      return
    }
    setNewSessionNameDraft('')
    setNewSessionDialogInstanceId(activeInstance.id)
  }

  const handleCloseNewSessionDialog = (): void => {
    setNewSessionDialogInstanceId(null)
    setNewSessionNameDraft('')
  }

  const handleCreateConversation = (): void => {
    if (!activeInstance || !canCreateNewConversation) {
      return
    }

    createConversation(activeInstance.id, newSessionNameDraft, {
      agentId: selectedAgentId
    })
    setNewSessionDialogInstanceId(null)
    setNewSessionNameDraft('')
  }

  const handleOpenSessionDialog = (): void => {
    if (!activeInstance) {
      return
    }

    setPendingSessionKey(resolvedSessionKey)
    setSessionDialogInstanceId(activeInstance.id)
    void loadSessionOptions(activeInstance.id, resolvedSessionKey, {
      agentId: selectedAgentId
    })
  }

  const handleCloseSessionDialog = (): void => {
    if (sessionDialogLoading) {
      return
    }

    setSessionDialogInstanceId(null)
    resetSessionDialogState()
  }

  const handleConfirmSessionSwitch = (): void => {
    if (!activeInstance) {
      return
    }

    confirmSessionSwitch(activeInstance.id)
    setSessionDialogInstanceId(null)
  }

  return (
    <AppShellContentArea
      contentScrollable={false}
      disableInnerPadding
      contentClassName="min-h-0 flex-1"
      innerClassName="flex h-full min-h-0 flex-col gap-0"
      header={
        instances.length > 0 ? (
          <HomeChatHeader
            selectedAgentId={selectedAgentId}
            agentItems={agentHeaderItems}
            connectionConfig={activeInstance?.connectionConfig ?? null}
            agentsLoading={agents.loading}
            activeInstanceConnected={activeInstanceConnected}
            canCreateNewConversation={canCreateNewConversation}
            onSelectAgent={agents.setSelectedAgentId}
            onOpenSessionDialog={handleOpenSessionDialog}
            onOpenNewSessionDialog={handleOpenNewSessionDialog}
          />
        ) : undefined
      }
    >
      {!activeInstance ? (
        <OpenClawNoInstanceState
          message={t('chat.page.noInstance')}
          onOpenConfig={() => navigate('/config')}
        />
      ) : activeInstance.connectionState !== 'connected' ? (
        <OpenClawConnectionStatePanel
          instance={activeInstance}
          reconnectPending={reconnectingInstanceId === activeInstance.id}
          onReconnect={(instance) => {
            setNewSessionDialogInstanceId(null)
            setNewSessionNameDraft('')
            setSessionDialogInstanceId(null)
            resetSessionDialogState()
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
        <section className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <ChatTranscript
            messages={messages}
            messageTraces={messageTraces}
            connectionConfig={activeInstance?.connectionConfig}
            assistantAvatar={assistantAvatar}
            userAvatar={userAvatar}
            loadingHistory={showHistoryLoadingState}
            historyError={historyError}
            activeInstanceName={
              selectedAgentId
                ? (agentSelectOptions.find((o) => o.value === selectedAgentId)?.label ??
                  activeInstance?.name ??
                  '')
                : (activeInstance?.name ?? '')
            }
            className="conversation-scroll-area min-h-0 flex-1"
            innerClassName="px-6 pb-4"
            emptyStateClassName="px-6"
          />

          <div className="shrink-0 border-t border-black/6 bg-card px-6 py-3">
            <ChatComposer
              onSubmit={handleSubmitMessage}
              ariaLabel={t('chat.composer.ariaInput')}
              placeholder={
                selectedAgentId
                  ? t('chat.composer.placeholderToAgent', {
                      agent:
                        agentSelectOptions.find((o) => o.value === selectedAgentId)?.label ??
                        t('chat.agent.defaultName')
                    })
                  : t('chat.composer.placeholderToInstance', {
                      instance: activeInstance.name
                    })
              }
              submitLabel={t('chat.composer.submit')}
              disabled={showHistoryLoadingState}
              submitting={submitting}
              showShortcutHint
              shortcutHint={sendShortcutHint}
              sendShortcuts={composerSendShortcuts}
              showSubmitText={false}
              footerLeading={
                <ChatModelSelector
                  value={chatModelSelector.value}
                  options={chatModelSelector.options}
                  onValueChange={chatModelSelector.onValueChange}
                  placeholder={chatModelSelector.placeholder}
                  ariaLabel={t('chat.model.ariaSwitch')}
                  disabled={showHistoryLoadingState || submitting || chatModelSelector.loading}
                />
              }
            />
          </div>
        </section>
      )}

      {newSessionDialogOpen && activeInstance && activeInstanceConnected ? (
        <NewSessionDialog
          nameDraft={newSessionNameDraft}
          canCreateConversation={canCreateNewConversation}
          onNameDraftChange={setNewSessionNameDraft}
          onClose={handleCloseNewSessionDialog}
          onCreate={handleCreateConversation}
        />
      ) : null}

      {sessionDialogOpen && activeInstance && activeInstanceConnected ? (
        <SessionSwitchDialog
          sessions={sessionDialogSessions}
          currentSessionKey={resolvedSessionKey}
          pendingSessionKey={pendingSessionKey}
          undeletableSessionKeys={[
            DEFAULT_CHAT_SESSION_KEY,
            agentMainSessionKey ?? DEFAULT_CHAT_SESSION_KEY
          ]}
          loading={sessionDialogLoading}
          error={sessionDialogError}
          onRetry={() => {
            void loadSessionOptions(activeInstance.id, resolvedSessionKey, {
              agentId: selectedAgentId
            })
          }}
          onSelectSession={setPendingSessionKey}
          onRenameSession={async (sessionKey, nextName) => {
            await renameConversation(activeInstance.id, sessionKey, nextName)
            await loadSessionOptions(activeInstance.id, resolvedSessionKey, {
              agentId: selectedAgentId
            })
          }}
          onDeleteSession={async (sessionKey) => {
            const fallbackSessionKey = agentMainSessionKey ?? DEFAULT_CHAT_SESSION_KEY
            await deleteConversation(activeInstance.id, sessionKey, {
              fallbackSessionKey,
              protectedSessionKeys: [DEFAULT_CHAT_SESSION_KEY, fallbackSessionKey]
            })

            const listCurrentSessionKey = isSameGatewaySessionKey(sessionKey, resolvedSessionKey)
              ? fallbackSessionKey
              : resolvedSessionKey
            await loadSessionOptions(activeInstance.id, listCurrentSessionKey, {
              agentId: selectedAgentId
            })
          }}
          onConfirm={handleConfirmSessionSwitch}
          onClose={handleCloseSessionDialog}
        />
      ) : null}
    </AppShellContentArea>
  )
}

export default HomePage
