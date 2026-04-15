import type { ComponentProps } from 'react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import {
  createEmptyOpenClawAgentSettingsDraft,
  OPENCLAW_AGENT_PERSONA_FILE_NAMES,
  OPENCLAW_TOOL_PROFILE_PRESET_IDS
} from '@/features/agents/lib/openclaw-agents-center-constants'
import type {
  OpenClawAgentTabId,
  OpenClawToolProfilePresetId
} from '@/features/agents/lib/openclaw-agents-center-types'
import { resolveOpenClawAgentDisplayName } from '@/features/agents/lib/openclaw-agent-presenters'
import {
  buildAgentSettingsDraft,
  buildConfigWithUpdatedAgentEntry,
  composeAgentEntryFromSettingsDraft,
  deepClone,
  findAgentEntry,
  isRecord,
  type OpenClawAgentSettingsDraft
} from '@/features/agents/lib/openclaw-agent-config-entry'
import {
  isMemoryFileName,
  sortMemoryFileNames
} from '@/features/agents/lib/openclaw-agent-memory-files'
import {
  applyToolPolicyToAgentEntry,
  buildAgentToolPolicy,
  resolveToolEnabled,
  toggleToolInPolicy
} from '@/features/agents/lib/openclaw-agent-tool-policy'
import {
  toggleSkillAllowlist,
  resolveSkillEnabled
} from '@/features/agents/lib/openclaw-agent-skill-policy'
import {
  getOpenClawConfigSnapshot,
  setOpenClawConfigSnapshot
} from '@/features/agents/lib/openclaw-agents-api'
import type {
  OpenClawAgentSummary,
  OpenClawAgentFileEntry,
  OpenClawConfigSnapshot,
  OpenClawToolCatalogEntry
} from '@/features/agents/lib/openclaw-agents-types'
import type OpenClawAgentFilesTab from '@/features/agents/components/openclaw-agent-files-tab'
import type OpenClawAgentMemoryTab from '@/features/agents/components/openclaw-agent-memory-tab'
import type OpenClawAgentSettingsTab from '@/features/agents/components/openclaw-agent-settings-tab'
import type OpenClawAgentSkillsTab from '@/features/agents/components/openclaw-agent-skills-tab'
import type OpenClawAgentToolsTab from '@/features/agents/components/openclaw-agent-tools-tab'
import {
  deleteLocalMemoryFile,
  listLocalMemoryFiles,
  readLocalMemoryFile,
  writeLocalMemoryFile
} from '@/features/agents/lib/openclaw-agent-local-memory'
import {
  deleteMemoryFileViaSsh,
  discoverMemoryFilesViaSsh,
  normalizePosixPath,
  readMemoryFileViaSsh,
  resolveMemoryWorkspaceCandidates,
  writeMemoryFileViaSsh
} from '@/features/agents/lib/openclaw-agent-ssh-memory'
import { useOpenClawAgentFiles } from '@/features/agents/lib/use-openclaw-agent-files'
import { useOpenClawAgents } from '@/features/agents/lib/use-openclaw-agents'
import { useOpenClawModelChoices } from '@/features/agents/lib/use-openclaw-model-choices'
import { useOpenClawToolsCatalog } from '@/features/agents/lib/use-openclaw-tools-catalog'
import { isLocalOpenClawConnection } from '@/features/instances/lib/openclaw-connection-config'
import { useOpenClawConnectionActions } from '@/features/instances/lib/use-openclaw-connection-actions'
import { useWorkspaceInstanceSelection } from '@/features/instances/lib/use-workspace-instance-selection'
import type { OpenClawInstance } from '@/features/instances/store/use-app-store'
import { useAppStore } from '@/features/instances/store/use-app-store'
import { listOpenClawSkills } from '@/features/skills/lib/openclaw-skills-api'
import type { OpenClawSkillStatusReport } from '@/features/skills/lib/openclaw-skills-types'
import { translateWithAppLanguage } from '@/shared/i18n/app-i18n'

function createRandomUuid(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID()
  }

  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const random = Math.floor(Math.random() * 16)
    const next = char === 'x' ? random : (random & 0x3) | 0x8
    return next.toString(16)
  })
}

function pickFirstExistingFile(
  targetFileNames: string[],
  availableFileNames: string[]
): string | null {
  for (const name of targetFileNames) {
    if (availableFileNames.includes(name)) {
      return name
    }
  }
  return null
}

function canDeleteMemoryFile(fileName: string | null | undefined): boolean {
  const normalized = fileName?.trim().toLowerCase() ?? ''
  return normalized.startsWith('memory/')
}

function resolveWorkspaceFromMemoryFilePath(filePath: string, fileName: string): string | null {
  const normalizedPath = normalizePosixPath(filePath.trim())
  const normalizedFileName = normalizePosixPath(fileName.trim()).replace(/^\/+/, '')
  if (!normalizedPath || !normalizedFileName) {
    return null
  }

  const suffix = `/${normalizedFileName}`
  if (!normalizedPath.endsWith(suffix)) {
    return null
  }

  const workspacePath = normalizedPath.slice(0, -suffix.length).trim()
  return workspacePath || null
}

type UseAgentsCenterPageControllerParams = {
  preferredAgentId?: string | null
}

type UseAgentsCenterPageControllerResult = {
  instances: OpenClawInstance[]
  selectedInstance: OpenClawInstance | null
  selectedInstanceConnected: boolean
  selectedInstanceRequiresConnectionConfig: boolean
  reconnectingInstanceId: string | null
  reconnectSelectedInstance: (instance: OpenClawInstance) => Promise<void>
  activeTab: OpenClawAgentTabId
  setActiveTab: (tab: OpenClawAgentTabId) => void
  agentsList: OpenClawAgentSummary[]
  selectedAgentId: string | null
  selectedAgent: OpenClawAgentSummary | null
  selectedAgentDisplayName: string
  defaultAgentId: string | undefined
  agentsLoading: boolean
  agentsError: string | null
  agentsCreating: boolean
  selectAgent: (agentId: string) => void
  createDialogOpen: boolean
  createDialogError: string | null
  openCreateDialog: () => void
  closeCreateDialog: () => void
  submitCreateAgent: (payload: {
    name: string
    workspace?: string
    emoji?: string
    avatar?: string
  }) => Promise<void>
  personaTabProps: ComponentProps<typeof OpenClawAgentFilesTab>
  memoryTabProps: ComponentProps<typeof OpenClawAgentMemoryTab>
  toolsTabProps: ComponentProps<typeof OpenClawAgentToolsTab>
  skillsTabProps: ComponentProps<typeof OpenClawAgentSkillsTab>
  settingsTabProps: ComponentProps<typeof OpenClawAgentSettingsTab>
  paramsDialogOpen: boolean
  paramsDialogError: string | null
  paramsDialogInitialValue: string
  closeParamsDialog: () => void
  submitParamsDialog: (nextValue: string) => void
}

export const useAgentsCenterPageController = ({
  preferredAgentId
}: UseAgentsCenterPageControllerParams): UseAgentsCenterPageControllerResult => {
  const instances = useAppStore((state) => state.instances)
  const { connectInstance } = useOpenClawConnectionActions()
  const { selectedInstance } = useWorkspaceInstanceSelection()

  const [reconnectingInstanceId, setReconnectingInstanceId] = useState<string | null>(null)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [createDialogError, setCreateDialogError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<OpenClawAgentTabId>('persona')
  const [configLoading, setConfigLoading] = useState(false)
  const [configSaving, setConfigSaving] = useState(false)
  const [configError, setConfigError] = useState<string | null>(null)
  const [configSnapshot, setConfigSnapshot] = useState<OpenClawConfigSnapshot | null>(null)
  const [settingsDraft, setSettingsDraft] =
    useState<OpenClawAgentSettingsDraft>(() => createEmptyOpenClawAgentSettingsDraft())
  const [paramsDialogOpen, setParamsDialogOpen] = useState(false)
  const [paramsDialogError, setParamsDialogError] = useState<string | null>(null)
  const [skillsLoading, setSkillsLoading] = useState(false)
  const [skillsError, setSkillsError] = useState<string | null>(null)
  const [skillsReport, setSkillsReport] = useState<OpenClawSkillStatusReport | null>(null)
  const [memoryActiveFileName, setMemoryActiveFileName] = useState<string | null>(null)
  const [memoryFolderExpanded, setMemoryFolderExpanded] = useState(false)
  const [memoryFolderLoading, setMemoryFolderLoading] = useState(false)
  const [memoryFolderLoaded, setMemoryFolderLoaded] = useState(false)
  const [sshFallbackMemoryFileNames, setSshFallbackMemoryFileNames] = useState<string[]>([])
  const [sshFallbackMemoryWorkspaceByName, setSshFallbackMemoryWorkspaceByName] = useState<
    Record<string, string>
  >({})
  const [sshMemoryFileBaseByName, setSshMemoryFileBaseByName] = useState<Record<string, string>>({})
  const [sshMemoryFileDraftByName, setSshMemoryFileDraftByName] = useState<Record<string, string>>(
    {}
  )
  const [sshMemoryLoading, setSshMemoryLoading] = useState(false)
  const [sshMemorySaving, setSshMemorySaving] = useState(false)
  const [sshMemoryDeleting, setSshMemoryDeleting] = useState(false)
  const [sshFallbackMemoryError, setSshFallbackMemoryError] = useState<string | null>(null)

  const configRequestIdRef = useRef(0)
  const skillsRequestIdRef = useRef(0)
  const sshMemoryRequestIdRef = useRef(0)

  const selectedInstanceConnected = selectedInstance?.connectionState === 'connected'
  const selectedInstanceRequiresConnectionConfig = selectedInstance?.connectionConfig === null
  const gatewayInstanceId = selectedInstanceConnected ? selectedInstance.id : null

  const agents = useOpenClawAgents({
    instanceId: gatewayInstanceId,
    enabled: selectedInstanceConnected
  })
  const agentsList = useMemo(() => agents.agentsList?.agents ?? [], [agents.agentsList])
  const selectedAgent = agents.selectedAgent
  const selectedAgentId = agents.selectedAgentId

  const modelChoices = useOpenClawModelChoices({
    instanceId: gatewayInstanceId,
    enabled: selectedInstanceConnected
  })

  const agentFiles = useOpenClawAgentFiles({
    instanceId: gatewayInstanceId,
    agentId: selectedAgentId,
    enabled: selectedInstanceConnected && Boolean(selectedAgentId)
  })

  const toolsCatalog = useOpenClawToolsCatalog({
    instanceId: gatewayInstanceId,
    agentId: selectedAgentId,
    enabled: selectedInstanceConnected && Boolean(selectedAgentId),
    includePlugins: true
  })

  const selectedAgentEntry = useMemo(() => {
    if (!configSnapshot || !selectedAgentId) {
      return null
    }
    return findAgentEntry(configSnapshot.config, selectedAgentId).entry
  }, [configSnapshot, selectedAgentId])

  const selectedToolPolicy = useMemo(
    () =>
      buildAgentToolPolicy({
        config: configSnapshot?.config ?? {},
        agentEntry: selectedAgentEntry
      }),
    [configSnapshot, selectedAgentEntry]
  )

  const availableToolGroups = useMemo(() => {
    const groups = toolsCatalog.catalog?.groups ?? []
    return groups
      .map((group) => ({
        ...group,
        tools: [...group.tools].sort((left, right) => left.label.localeCompare(right.label))
      }))
      .filter((group) => group.tools.length > 0)
      .sort((left, right) => left.label.localeCompare(right.label))
  }, [toolsCatalog.catalog])

  const availableFileNames = useMemo(
    () => agentFiles.files.map((file) => file.name),
    [agentFiles.files]
  )
  const memoryFileNames = useMemo(
    () => sortMemoryFileNames(availableFileNames.filter(isMemoryFileName)),
    [availableFileNames]
  )
  const mergedMemoryFileNames = useMemo(
    () => sortMemoryFileNames([...memoryFileNames, ...sshFallbackMemoryFileNames]),
    [memoryFileNames, sshFallbackMemoryFileNames]
  )
  const rootMemoryFileNames = useMemo(
    () => mergedMemoryFileNames.filter((fileName) => !fileName.toLowerCase().startsWith('memory/')),
    [mergedMemoryFileNames]
  )
  const folderMemoryFileNames = useMemo(
    () => mergedMemoryFileNames.filter((fileName) => fileName.toLowerCase().startsWith('memory/')),
    [mergedMemoryFileNames]
  )
  const selectableMemoryFileNames = useMemo(
    () =>
      memoryFolderExpanded
        ? sortMemoryFileNames([...rootMemoryFileNames, ...folderMemoryFileNames])
        : rootMemoryFileNames,
    [folderMemoryFileNames, memoryFolderExpanded, rootMemoryFileNames]
  )
  const sshFallbackMemoryFileNameSet = useMemo(
    () => new Set(sshFallbackMemoryFileNames),
    [sshFallbackMemoryFileNames]
  )
  const memoryTabFiles = useMemo(() => {
    const byName = new Map<string, OpenClawAgentFileEntry>()
    for (const file of agentFiles.files) {
      byName.set(file.name, file)
    }

    const baseWorkspace = (agentFiles.workspace || selectedAgent?.workspace || '').trim()
    for (const fileName of mergedMemoryFileNames) {
      if (byName.has(fileName)) {
        continue
      }

      const fallbackWorkspace = sshFallbackMemoryWorkspaceByName[fileName] ?? baseWorkspace
      const normalizedBase = normalizePosixPath(fallbackWorkspace)
      const normalizedPath = normalizedBase ? `${normalizedBase}/${fileName}` : fileName
      byName.set(fileName, {
        name: fileName,
        path: normalizedPath,
        missing: false
      })
    }

    return Array.from(byName.values())
  }, [
    agentFiles.files,
    agentFiles.workspace,
    mergedMemoryFileNames,
    selectedAgent?.workspace,
    sshFallbackMemoryWorkspaceByName
  ])
  const memoryActiveFileEntry = useMemo(
    () =>
      memoryActiveFileName
        ? (memoryTabFiles.find((file) => file.name === memoryActiveFileName) ?? null)
        : null,
    [memoryActiveFileName, memoryTabFiles]
  )
  const memoryActiveFileCanDelete = canDeleteMemoryFile(memoryActiveFileName)

  const memoryActiveUsesSshFallback = useMemo(
    () => Boolean(memoryActiveFileName && sshFallbackMemoryFileNameSet.has(memoryActiveFileName)),
    [memoryActiveFileName, sshFallbackMemoryFileNameSet]
  )
  const activeSshMemoryBase = memoryActiveFileName
    ? (sshMemoryFileBaseByName[memoryActiveFileName] ?? '')
    : ''
  const activeSshMemoryDraft = memoryActiveFileName
    ? (sshMemoryFileDraftByName[memoryActiveFileName] ?? activeSshMemoryBase)
    : ''
  const activeSshMemoryDirty =
    Boolean(memoryActiveFileName) && activeSshMemoryDraft !== activeSshMemoryBase

  const modelOptions = useMemo(() => {
    const modelRefs = new Set<string>()
    for (const model of modelChoices.models) {
      const normalized = model.id.trim()
      if (normalized) {
        modelRefs.add(normalized)
      }
    }
    if (settingsDraft.model.trim()) {
      modelRefs.add(settingsDraft.model.trim())
    }
    return Array.from(modelRefs).sort((left, right) => left.localeCompare(right))
  }, [modelChoices.models, settingsDraft.model])

  const allowAgentOptions = useMemo(
    () =>
      agentsList
        .map((agent) => agent.id.trim())
        .filter((agentId) => agentId && agentId !== settingsDraft.id.trim())
        .sort((left, right) => left.localeCompare(right)),
    [agentsList, settingsDraft.id]
  )

  const selectedAgentDisplayName = selectedAgent ? resolveOpenClawAgentDisplayName(selectedAgent) : ''
  const toolProfilePresets = useMemo(() => {
    const activePresetId: OpenClawToolProfilePresetId = selectedToolPolicy.profileInherited
      ? 'inherit'
      : selectedToolPolicy.profile

    return OPENCLAW_TOOL_PROFILE_PRESET_IDS.map((presetId) => ({
      id: presetId,
      active: activePresetId === presetId
    }))
  }, [selectedToolPolicy.profile, selectedToolPolicy.profileInherited])

  const reloadConfigSnapshot = useCallback(async (): Promise<void> => {
    if (!gatewayInstanceId) {
      return
    }

    const requestId = configRequestIdRef.current + 1
    configRequestIdRef.current = requestId
    setConfigLoading(true)
    setConfigError(null)

    try {
      const snapshot = await getOpenClawConfigSnapshot(gatewayInstanceId)
      if (requestId !== configRequestIdRef.current) {
        return
      }
      setConfigSnapshot(snapshot)
    } catch (error) {
      if (requestId === configRequestIdRef.current) {
        setConfigError(
          error instanceof Error ? error.message : translateWithAppLanguage('agents.error.readConfigFailed')
        )
      }
    } finally {
      if (requestId === configRequestIdRef.current) {
        setConfigLoading(false)
      }
    }
  }, [gatewayInstanceId])

  const reloadAgentSkills = useCallback(async (): Promise<void> => {
    if (!gatewayInstanceId || !selectedAgentId) {
      return
    }

    const requestId = skillsRequestIdRef.current + 1
    skillsRequestIdRef.current = requestId
    setSkillsLoading(true)
    setSkillsError(null)

    try {
      const report = await listOpenClawSkills(gatewayInstanceId, {
        agentId: selectedAgentId
      })
      if (requestId !== skillsRequestIdRef.current) {
        return
      }
      setSkillsReport(report)
    } catch (error) {
      if (requestId === skillsRequestIdRef.current) {
        setSkillsError(
          error instanceof Error ? error.message : translateWithAppLanguage('agents.error.readSkillsFailed')
        )
      }
    } finally {
      if (requestId === skillsRequestIdRef.current) {
        setSkillsLoading(false)
      }
    }
  }, [gatewayInstanceId, selectedAgentId])

  const loadSshFallbackMemoryFile = useCallback(
    async (
      fileName: string,
      options?: {
        force?: boolean
        preserveDraft?: boolean
      }
    ): Promise<void> => {
      const connectionConfig = selectedInstance?.connectionConfig
      if (!connectionConfig) {
        return
      }
      const useLocalMemory = isLocalOpenClawConnection(connectionConfig)

      if (
        !options?.force &&
        Object.prototype.hasOwnProperty.call(sshMemoryFileBaseByName, fileName)
      ) {
        return
      }

      const workspaceCandidates = resolveMemoryWorkspaceCandidates({
        selectedAgentWorkspace: selectedAgent?.workspace,
        filesWorkspace: agentFiles.workspace
      })
      const preferredWorkspace = sshFallbackMemoryWorkspaceByName[fileName]
      const orderedWorkspaces = preferredWorkspace
        ? [
            preferredWorkspace,
            ...workspaceCandidates.filter((value) => value !== preferredWorkspace)
          ]
        : workspaceCandidates
      if (orderedWorkspaces.length === 0) {
        setSshFallbackMemoryError(translateWithAppLanguage('agents.error.readMemoryWorkspaceMissing'))
        return
      }

      setSshMemoryLoading(true)
      setSshFallbackMemoryError(null)

      try {
        let resolvedWorkspace: string | null = null
        let content = ''
        const errors: string[] = []

        for (const workspacePath of orderedWorkspaces) {
          try {
            const readResult = useLocalMemory
              ? await readLocalMemoryFile({
                  workspacePath,
                  relativeFilePath: fileName
                })
              : await readMemoryFileViaSsh({
                  connection: connectionConfig,
                  workspacePath,
                  relativeFilePath: fileName
                })
            if (!readResult.found) {
              continue
            }
            resolvedWorkspace = workspacePath
            content = readResult.content
            break
          } catch (error) {
            errors.push(
              error instanceof Error ? error.message : translateWithAppLanguage('agents.error.readMemoryFileFailed')
            )
          }
        }

        if (!resolvedWorkspace) {
          throw new Error(
            errors[0] ||
              translateWithAppLanguage('agents.error.memoryFileNotFound', {
                fileName
              })
          )
        }

        setSshFallbackMemoryWorkspaceByName((current) => ({
          ...current,
          [fileName]: resolvedWorkspace
        }))
        setSshMemoryFileBaseByName((current) => ({
          ...current,
          [fileName]: content
        }))
        setSshMemoryFileDraftByName((current) => {
          const preserveDraft = options?.preserveDraft ?? true
          if (
            preserveDraft &&
            Object.prototype.hasOwnProperty.call(current, fileName) &&
            current[fileName] !== (sshMemoryFileBaseByName[fileName] ?? '')
          ) {
            return current
          }

          return {
            ...current,
            [fileName]: content
          }
        })
      } catch (error) {
        setSshFallbackMemoryError(
          error instanceof Error ? error.message : translateWithAppLanguage('agents.error.readMemoryFileFailed')
        )
      } finally {
        setSshMemoryLoading(false)
      }
    },
    [
      agentFiles.workspace,
      selectedAgent?.workspace,
      selectedInstance?.connectionConfig,
      sshFallbackMemoryWorkspaceByName,
      sshMemoryFileBaseByName
    ]
  )

  const handleSelectMemoryFile = useCallback(
    (fileName: string): void => {
      setMemoryActiveFileName(fileName)

      if (sshFallbackMemoryFileNameSet.has(fileName)) {
        void loadSshFallbackMemoryFile(fileName, { preserveDraft: true })
        return
      }

      agentFiles.selectFile(fileName)
    },
    [agentFiles, loadSshFallbackMemoryFile, sshFallbackMemoryFileNameSet]
  )

  const saveSshFallbackMemoryFile = useCallback(async (): Promise<void> => {
    if (!memoryActiveFileName) {
      return
    }

    const connectionConfig = selectedInstance?.connectionConfig
    if (!connectionConfig) {
      return
    }
    const useLocalMemory = isLocalOpenClawConnection(connectionConfig)

    const workspaceCandidates = resolveMemoryWorkspaceCandidates({
      selectedAgentWorkspace: selectedAgent?.workspace,
      filesWorkspace: agentFiles.workspace
    })
    const preferredWorkspace = sshFallbackMemoryWorkspaceByName[memoryActiveFileName]
    const targetWorkspace = preferredWorkspace ?? workspaceCandidates[0]
    if (!targetWorkspace) {
      setSshFallbackMemoryError(translateWithAppLanguage('agents.error.writeMemoryWorkspaceMissing'))
      return
    }

    setSshMemorySaving(true)
    setSshFallbackMemoryError(null)
    try {
      const content = activeSshMemoryDraft
      if (useLocalMemory) {
        await writeLocalMemoryFile({
          workspacePath: targetWorkspace,
          relativeFilePath: memoryActiveFileName,
          content
        })
      } else {
        await writeMemoryFileViaSsh({
          connection: connectionConfig,
          workspacePath: targetWorkspace,
          relativeFilePath: memoryActiveFileName,
          content
        })
      }

      setSshFallbackMemoryWorkspaceByName((current) => ({
        ...current,
        [memoryActiveFileName]: targetWorkspace
      }))
      setSshMemoryFileBaseByName((current) => ({
        ...current,
        [memoryActiveFileName]: content
      }))
      setSshMemoryFileDraftByName((current) => ({
        ...current,
        [memoryActiveFileName]: content
      }))
    } catch (error) {
      setSshFallbackMemoryError(
        error instanceof Error ? error.message : translateWithAppLanguage('agents.error.writeMemoryFileFailed')
      )
    } finally {
      setSshMemorySaving(false)
    }
  }, [
    activeSshMemoryDraft,
    agentFiles.workspace,
    memoryActiveFileName,
    selectedAgent?.workspace,
    selectedInstance?.connectionConfig,
    sshFallbackMemoryWorkspaceByName
  ])

  useEffect(() => {
    if (!selectedInstanceConnected || !gatewayInstanceId) {
      configRequestIdRef.current += 1
      setConfigLoading(false)
      setConfigError(null)
      setConfigSnapshot(null)
      return
    }

    void reloadConfigSnapshot()
  }, [gatewayInstanceId, reloadConfigSnapshot, selectedInstanceConnected])

  useEffect(() => {
    if (!selectedAgentId || !selectedInstanceConnected) {
      skillsRequestIdRef.current += 1
      setSkillsLoading(false)
      setSkillsError(null)
      setSkillsReport(null)
      return
    }

    if (activeTab === 'skills') {
      void reloadAgentSkills()
    }
  }, [activeTab, reloadAgentSkills, selectedAgentId, selectedInstanceConnected])

  useEffect(() => {
    if (!selectedAgentId) {
      setSettingsDraft(createEmptyOpenClawAgentSettingsDraft())
      return
    }

    setSettingsDraft(
      buildAgentSettingsDraft({
        entry: selectedAgentEntry,
        summary: selectedAgent
      })
    )
  }, [selectedAgent, selectedAgentEntry, selectedAgentId])

  useEffect(() => {
    if (!preferredAgentId || agentsList.length === 0) {
      return
    }
    if (agentsList.some((agent) => agent.id === preferredAgentId)) {
      agents.setSelectedAgentId(preferredAgentId)
    }
  }, [agents, agentsList, preferredAgentId])

  useEffect(() => {
    if (activeTab !== 'persona') {
      return
    }
    const preferredFileName = pickFirstExistingFile(
      OPENCLAW_AGENT_PERSONA_FILE_NAMES,
      availableFileNames
    )
    if (!preferredFileName) {
      return
    }
    if (
      !agentFiles.activeFileName ||
      !OPENCLAW_AGENT_PERSONA_FILE_NAMES.includes(agentFiles.activeFileName)
    ) {
      agentFiles.selectFile(preferredFileName)
    }
  }, [activeTab, agentFiles, availableFileNames])

  useEffect(() => {
    setMemoryActiveFileName(null)
    setMemoryFolderExpanded(false)
    setMemoryFolderLoading(false)
    setMemoryFolderLoaded(false)
    setSshFallbackMemoryFileNames([])
    setSshFallbackMemoryWorkspaceByName({})
    setSshMemoryFileBaseByName({})
    setSshMemoryFileDraftByName({})
    setSshMemoryLoading(false)
    setSshMemorySaving(false)
    setSshMemoryDeleting(false)
    setSshFallbackMemoryError(null)
  }, [selectedAgentId])

  useEffect(() => {
    const requestId = sshMemoryRequestIdRef.current + 1
    sshMemoryRequestIdRef.current = requestId
    setSshFallbackMemoryError(null)
    setMemoryFolderLoading(false)

    if (
      !selectedInstanceConnected ||
      !selectedAgentId ||
      activeTab !== 'memory' ||
      !memoryFolderExpanded
    ) {
      return
    }
    if (memoryFolderLoaded) {
      return
    }

    const connectionConfig = selectedInstance?.connectionConfig
    if (!connectionConfig) {
      setMemoryFolderLoaded(true)
      return
    }
    const useLocalMemory = isLocalOpenClawConnection(connectionConfig)

    const workspaceCandidates = resolveMemoryWorkspaceCandidates({
      selectedAgentWorkspace: selectedAgent?.workspace,
      filesWorkspace: agentFiles.workspace
    })
    if (workspaceCandidates.length === 0) {
      setMemoryFolderLoaded(true)
      return
    }

    setMemoryFolderLoading(true)

    void (async () => {
      const discoveredWorkspaceByName: Record<string, string> = {}
      const errors: string[] = []

      for (const workspace of workspaceCandidates) {
        try {
          const names = useLocalMemory
            ? await listLocalMemoryFiles(workspace)
            : await discoverMemoryFilesViaSsh({
                connection: connectionConfig,
                workspacePath: workspace
              })
          for (const name of names) {
            if (!discoveredWorkspaceByName[name]) {
              discoveredWorkspaceByName[name] = workspace
            }
          }
        } catch (error) {
          errors.push(
            error instanceof Error ? error.message : translateWithAppLanguage('agents.error.readMemoryDirFailed')
          )
        }
      }

      if (requestId !== sshMemoryRequestIdRef.current) {
        return
      }

      const discoveredNames = sortMemoryFileNames(Object.keys(discoveredWorkspaceByName))
      setSshFallbackMemoryFileNames(discoveredNames)
      setSshFallbackMemoryWorkspaceByName(discoveredWorkspaceByName)
      if (discoveredNames.length === 0 && errors.length > 0) {
        setSshFallbackMemoryError(
          errors[0] ?? translateWithAppLanguage('agents.error.readMemoryDirFailed')
        )
      }
      setMemoryFolderLoaded(true)
      setMemoryFolderLoading(false)
    })()
  }, [
    activeTab,
    agentFiles.workspace,
    memoryFolderExpanded,
    memoryFolderLoaded,
    selectedAgent?.workspace,
    selectedAgentId,
    selectedInstance?.connectionConfig,
    selectedInstanceConnected
  ])

  useEffect(() => {
    if (activeTab !== 'memory') {
      return
    }
    const preferredFileName = selectableMemoryFileNames[0] ?? null
    if (!preferredFileName) {
      return
    }

    if (!memoryActiveFileName || !selectableMemoryFileNames.includes(memoryActiveFileName)) {
      handleSelectMemoryFile(preferredFileName)
    }
  }, [activeTab, handleSelectMemoryFile, memoryActiveFileName, selectableMemoryFileNames])

  useEffect(() => {
    if (activeTab !== 'memory' || !memoryActiveFileName) {
      return
    }
    if (!sshFallbackMemoryFileNameSet.has(memoryActiveFileName)) {
      return
    }
    if (Object.prototype.hasOwnProperty.call(sshMemoryFileBaseByName, memoryActiveFileName)) {
      return
    }

    void loadSshFallbackMemoryFile(memoryActiveFileName, { preserveDraft: true })
  }, [
    activeTab,
    loadSshFallbackMemoryFile,
    memoryActiveFileName,
    sshFallbackMemoryFileNameSet,
    sshMemoryFileBaseByName
  ])

  const commitAgentEntry = useCallback(
    async (params: {
      agentId: string
      updater: (baseEntry: Record<string, unknown> | null) => {
        entry: Record<string, unknown> | null
        error: string | null
      }
    }): Promise<string | null> => {
      if (!gatewayInstanceId || !configSnapshot) {
        setConfigError(translateWithAppLanguage('agents.error.configNotLoaded'))
        return null
      }

      const found = findAgentEntry(configSnapshot.config, params.agentId)
      const updateResult = params.updater(found.entry ? deepClone(found.entry) : null)
      if (!updateResult.entry || updateResult.error) {
        setConfigError(updateResult.error || translateWithAppLanguage('agents.error.configWriteFailed'))
        return null
      }

      const nextConfigResult = buildConfigWithUpdatedAgentEntry({
        config: configSnapshot.config,
        currentAgentId: params.agentId,
        nextEntry: updateResult.entry
      })
      if (!nextConfigResult.config || nextConfigResult.error) {
        setConfigError(nextConfigResult.error || translateWithAppLanguage('agents.error.configWriteFailed'))
        return null
      }

      setConfigSaving(true)
      setConfigError(null)
      try {
        await setOpenClawConfigSnapshot(gatewayInstanceId, {
          config: nextConfigResult.config,
          baseHash: configSnapshot.hash
        })

        const refreshed = await getOpenClawConfigSnapshot(gatewayInstanceId)
        setConfigSnapshot(refreshed)
        await agents.reloadAgents()
        return nextConfigResult.resolvedAgentId
      } catch (error) {
        setConfigError(
          error instanceof Error ? error.message : translateWithAppLanguage('agents.error.configWriteFailed')
        )
        return null
      } finally {
        setConfigSaving(false)
      }
    },
    [agents, configSnapshot, gatewayInstanceId]
  )

  const handleCreateAgent = useCallback(
    async (payload: {
      name: string
      workspace?: string
      emoji?: string
      avatar?: string
    }): Promise<void> => {
      setCreateDialogError(null)

      try {
        const agentId = await agents.createAgent(payload)
        setCreateDialogOpen(false)
        setActiveTab('settings')
        agents.setSelectedAgentId(agentId)
        await reloadConfigSnapshot()
      } catch (error) {
        setCreateDialogError(
          error instanceof Error ? error.message : translateWithAppLanguage('agents.error.createFailed')
        )
      }
    },
    [agents, reloadConfigSnapshot]
  )

  const handleToggleTool = useCallback(
    (tool: OpenClawToolCatalogEntry, enabled: boolean): void => {
      if (!selectedAgentId || !configSnapshot) {
        return
      }

      void commitAgentEntry({
        agentId: selectedAgentId,
        updater: (baseEntry) => {
          const entry = baseEntry ?? { id: selectedAgentId }
          if (!entry.id || typeof entry.id !== 'string' || entry.id.trim().length === 0) {
            entry.id = selectedAgentId
          }

          const currentPolicy = buildAgentToolPolicy({
            config: configSnapshot.config,
            agentEntry: entry
          })
          const nextPolicy = toggleToolInPolicy({
            tool,
            policy: currentPolicy,
            enabled
          })
          const nextEntry = applyToolPolicyToAgentEntry({
            agentEntry: entry,
            policy: nextPolicy
          })
          return {
            entry: nextEntry,
            error: null
          }
        }
      })
    },
    [commitAgentEntry, configSnapshot, selectedAgentId]
  )

  const handleApplyToolProfilePreset = useCallback(
    (presetId: OpenClawToolProfilePresetId): void => {
      if (!selectedAgentId) {
        return
      }

      void commitAgentEntry({
        agentId: selectedAgentId,
        updater: (baseEntry) => {
          const entry = baseEntry ?? { id: selectedAgentId }
          if (!entry.id || typeof entry.id !== 'string' || entry.id.trim().length === 0) {
            entry.id = selectedAgentId
          }

          const tools = isRecord(entry.tools) ? { ...entry.tools } : {}
          if (presetId === 'inherit') {
            delete tools.profile
          } else {
            tools.profile = presetId
          }
          delete tools.allow
          delete tools.alsoAllow
          delete tools.deny

          if (Object.keys(tools).length === 0) {
            delete entry.tools
          } else {
            entry.tools = tools
          }

          return {
            entry,
            error: null
          }
        }
      })
    },
    [commitAgentEntry, selectedAgentId]
  )

  const handleToggleSkill = useCallback(
    (skillName: string, enabled: boolean): void => {
      if (!selectedAgentId || !skillsReport) {
        return
      }

      void commitAgentEntry({
        agentId: selectedAgentId,
        updater: (baseEntry) => {
          const entry = baseEntry ?? { id: selectedAgentId }
          if (!entry.id || typeof entry.id !== 'string' || entry.id.trim().length === 0) {
            entry.id = selectedAgentId
          }

          return {
            entry: toggleSkillAllowlist({
              agentEntry: entry,
              allSkillNames: skillsReport.skills.map((item) => item.name),
              skillName,
              enabled
            }),
            error: null
          }
        }
      })
    },
    [commitAgentEntry, selectedAgentId, skillsReport]
  )

  const reconnectSelectedInstance = useCallback(
    async (instance: OpenClawInstance): Promise<void> => {
      setReconnectingInstanceId(instance.id)
      try {
        await connectInstance(instance, {
          optimisticConnecting: false
        })
      } finally {
        setReconnectingInstanceId((current) => (current === instance.id ? null : current))
      }
    },
    [connectInstance]
  )

  const openCreateDialog = useCallback(() => {
    setCreateDialogError(null)
    setCreateDialogOpen(true)
  }, [])

  const closeCreateDialog = useCallback(() => {
    if (agents.creating) {
      return
    }
    setCreateDialogOpen(false)
  }, [agents.creating])

  const openParamsDialog = useCallback(() => {
    setParamsDialogError(null)
    setParamsDialogOpen(true)
  }, [])

  const closeParamsDialog = useCallback(() => {
    setParamsDialogOpen(false)
  }, [])

  const submitParamsDialog = useCallback((nextValue: string): void => {
    const normalized = nextValue.trim()
    if (normalized) {
      try {
        JSON.parse(normalized)
      } catch {
        setParamsDialogError(translateWithAppLanguage('agents.error.paramsDialogInvalidJson'))
        return
      }
    }

    setSettingsDraft((current) => ({
      ...current,
      paramsJson: nextValue
    }))
    setParamsDialogError(null)
    setParamsDialogOpen(false)
  }, [])

  const updateSettingsDraft = useCallback((patch: Partial<OpenClawAgentSettingsDraft>) => {
    setSettingsDraft((current) => ({
      ...current,
      ...patch
    }))
  }, [])

  const generateSettingsDraftId = useCallback(() => {
    setSettingsDraft((current) => ({
      ...current,
      id: createRandomUuid()
    }))
  }, [])

  const saveSettingsDraft = useCallback((nextDraft: OpenClawAgentSettingsDraft) => {
    if (!selectedAgentId) {
      return
    }

    void commitAgentEntry({
      agentId: selectedAgentId,
      updater: (baseEntry) =>
        composeAgentEntryFromSettingsDraft({
          baseEntry: baseEntry ?? { id: selectedAgentId },
          draft: nextDraft
        })
    }).then((resolvedAgentId) => {
      if (resolvedAgentId && resolvedAgentId !== selectedAgentId) {
        agents.setSelectedAgentId(resolvedAgentId)
      }
    })
  }, [agents, commitAgentEntry, selectedAgentId])

  const reloadSettingsConfig = useCallback(() => {
    void reloadConfigSnapshot()
  }, [reloadConfigSnapshot])

  const updateMemoryDraft = useCallback(
    (content: string): void => {
      if (memoryActiveUsesSshFallback && memoryActiveFileName) {
        setSshMemoryFileDraftByName((current) => ({
          ...current,
          [memoryActiveFileName]: content
        }))
        return
      }

      agentFiles.updateActiveDraft(content)
    },
    [agentFiles, memoryActiveFileName, memoryActiveUsesSshFallback]
  )

  const reloadMemoryFile = useCallback((): void => {
    if (memoryActiveUsesSshFallback && memoryActiveFileName) {
      void loadSshFallbackMemoryFile(memoryActiveFileName, {
        force: true,
        preserveDraft: false
      })
      return
    }
    void agentFiles.reloadActiveFile()
  }, [agentFiles, loadSshFallbackMemoryFile, memoryActiveFileName, memoryActiveUsesSshFallback])

  const resetMemoryDraft = useCallback((): void => {
    if (memoryActiveUsesSshFallback && memoryActiveFileName) {
      setSshMemoryFileDraftByName((current) => ({
        ...current,
        [memoryActiveFileName]: sshMemoryFileBaseByName[memoryActiveFileName] ?? ''
      }))
      return
    }
    agentFiles.resetActiveDraft()
  }, [agentFiles, memoryActiveFileName, memoryActiveUsesSshFallback, sshMemoryFileBaseByName])

  const saveMemoryFile = useCallback((): void => {
    if (memoryActiveUsesSshFallback) {
      void saveSshFallbackMemoryFile()
      return
    }
    void agentFiles.saveActiveFile()
  }, [agentFiles, memoryActiveUsesSshFallback, saveSshFallbackMemoryFile])

  const deleteMemoryFile = useCallback((): void => {
    if (!memoryActiveFileName || !canDeleteMemoryFile(memoryActiveFileName)) {
      return
    }

    const connectionConfig = selectedInstance?.connectionConfig
    if (!connectionConfig) {
      return
    }
    const useLocalMemory = isLocalOpenClawConnection(connectionConfig)

    const workspaceCandidates = resolveMemoryWorkspaceCandidates({
      selectedAgentWorkspace: selectedAgent?.workspace,
      filesWorkspace: agentFiles.workspace
    })
    const preferredWorkspaceFromPath = memoryActiveFileEntry
      ? resolveWorkspaceFromMemoryFilePath(memoryActiveFileEntry.path, memoryActiveFileName)
      : null
    const preferredWorkspaceFromMap = sshFallbackMemoryWorkspaceByName[memoryActiveFileName] ?? null
    const orderedWorkspaces = [
      preferredWorkspaceFromPath,
      preferredWorkspaceFromMap,
      ...workspaceCandidates
    ].filter((workspace, index, array): workspace is string => {
      if (!workspace) {
        return false
      }
      const normalized = normalizePosixPath(workspace)
      return array.findIndex((candidate) => normalizePosixPath(candidate ?? '') === normalized) === index
    })

    if (orderedWorkspaces.length === 0) {
      setSshFallbackMemoryError(translateWithAppLanguage('agents.error.deleteMemoryWorkspaceMissing'))
      return
    }

    const deletedFileName = memoryActiveFileName
    const nextFileName =
      sortMemoryFileNames([...rootMemoryFileNames, ...folderMemoryFileNames]).find(
        (fileName) => fileName !== deletedFileName
      ) ?? null

    setSshMemoryDeleting(true)
    setSshFallbackMemoryError(null)

    void (async () => {
      try {
        let deleted = false
        const errors: string[] = []

        for (const workspacePath of orderedWorkspaces) {
          try {
            const deletedInWorkspace = useLocalMemory
              ? await deleteLocalMemoryFile({
                  workspacePath,
                  relativeFilePath: deletedFileName
                })
              : await deleteMemoryFileViaSsh({
                  connection: connectionConfig,
                  workspacePath,
                  relativeFilePath: deletedFileName
                })
            if (deletedInWorkspace) {
              deleted = true
              break
            }
          } catch (error) {
            errors.push(
              error instanceof Error ? error.message : translateWithAppLanguage('agents.error.deleteMemoryFileFailed')
            )
          }
        }

        if (!deleted) {
          throw new Error(
            errors[0] ||
              translateWithAppLanguage('agents.error.deleteMemoryFileNotFound', {
                fileName: deletedFileName
              })
          )
        }

        setSshFallbackMemoryFileNames((current) =>
          current.filter((fileName) => fileName !== deletedFileName)
        )
        setSshFallbackMemoryWorkspaceByName((current) => {
          const next = { ...current }
          delete next[deletedFileName]
          return next
        })
        setSshMemoryFileBaseByName((current) => {
          const next = { ...current }
          delete next[deletedFileName]
          return next
        })
        setSshMemoryFileDraftByName((current) => {
          const next = { ...current }
          delete next[deletedFileName]
          return next
        })

        if (nextFileName) {
          setMemoryActiveFileName(nextFileName)
          if (sshFallbackMemoryFileNameSet.has(nextFileName)) {
            void loadSshFallbackMemoryFile(nextFileName, { preserveDraft: true })
          } else {
            agentFiles.selectFile(nextFileName)
          }
        } else {
          setMemoryActiveFileName(null)
        }

        await agentFiles.reloadFiles()
        setMemoryFolderLoaded(false)
      } catch (error) {
        setSshFallbackMemoryError(
          error instanceof Error ? error.message : translateWithAppLanguage('agents.error.deleteMemoryFileFailed')
        )
      } finally {
        setSshMemoryDeleting(false)
      }
    })()
  }, [
    agentFiles,
    folderMemoryFileNames,
    loadSshFallbackMemoryFile,
    memoryActiveFileEntry,
    memoryActiveFileName,
    rootMemoryFileNames,
    selectedAgent?.workspace,
    selectedInstance?.connectionConfig,
    sshFallbackMemoryFileNameSet,
    sshFallbackMemoryWorkspaceByName
  ])

  const toggleMemoryFolder = useCallback((expanded: boolean): void => {
    setMemoryFolderExpanded(expanded)
  }, [])

  const personaTabProps = {
    fileNames: OPENCLAW_AGENT_PERSONA_FILE_NAMES,
    files: agentFiles.files,
    activeFileName: agentFiles.activeFileName,
    draftContent: agentFiles.activeFileDraft,
    loading: agentFiles.loading,
    saving: agentFiles.saving,
    dirty: agentFiles.activeFileDirty,
    error: agentFiles.error,
    onSelectFile: agentFiles.selectFile,
    onDraftChange: agentFiles.updateActiveDraft,
    onReload: () => {
      void agentFiles.reloadActiveFile()
    },
    onReset: agentFiles.resetActiveDraft,
    onSave: () => {
      void agentFiles.saveActiveFile()
    }
  }

  const memoryTabProps = {
    rootFileNames: rootMemoryFileNames,
    folderFileNames: folderMemoryFileNames,
    folderExpanded: memoryFolderExpanded,
    folderLoading: memoryFolderLoading,
    files: memoryTabFiles,
    activeFileName: memoryActiveFileName,
    draftContent: memoryActiveUsesSshFallback ? activeSshMemoryDraft : agentFiles.activeFileDraft,
    loading: memoryActiveUsesSshFallback ? sshMemoryLoading : agentFiles.loading,
    saving: memoryActiveUsesSshFallback ? sshMemorySaving : agentFiles.saving,
    deleting: sshMemoryDeleting,
    canDeleteActiveFile: memoryActiveFileCanDelete,
    dirty: memoryActiveUsesSshFallback ? activeSshMemoryDirty : agentFiles.activeFileDirty,
    error: memoryActiveUsesSshFallback
      ? sshFallbackMemoryError
      : (agentFiles.error ?? sshFallbackMemoryError),
    onToggleFolder: toggleMemoryFolder,
    onSelectFile: handleSelectMemoryFile,
    onDraftChange: updateMemoryDraft,
    onReload: reloadMemoryFile,
    onReset: resetMemoryDraft,
    onSave: saveMemoryFile,
    onDelete: deleteMemoryFile
  }

  const toolsTabProps = {
    loading: toolsCatalog.loading || configLoading,
    saving: configSaving,
    error: configError || toolsCatalog.error,
    groups: availableToolGroups,
    profilePresets: toolProfilePresets,
    onSelectProfilePreset: handleApplyToolProfilePreset,
    resolveEnabled: (tool: OpenClawToolCatalogEntry) =>
      resolveToolEnabled({
        tool,
        policy: selectedToolPolicy
      }),
    onToggleTool: handleToggleTool
  }

  const skillsTabProps = {
    loading: skillsLoading,
    saving: configSaving,
    error: configError || skillsError,
    skills: skillsReport?.skills ?? [],
    resolveEnabled: (skill: { name: string }) =>
      resolveSkillEnabled({
        agentEntry: selectedAgentEntry,
        skillName: skill.name
      }),
    onToggleSkill: (skill: { name: string }, enabled: boolean) => {
      handleToggleSkill(skill.name, enabled)
    }
  }

  const settingsTabProps = {
    draft: settingsDraft,
    modelOptions,
    allowAgentOptions,
    connectionConfig: selectedInstance?.connectionConfig ?? null,
    fallbackWorkspace: selectedAgent?.workspace ?? '',
    loadingModels: modelChoices.loading,
    saving: configSaving,
    error: configError,
    onDraftChange: updateSettingsDraft,
    onGenerateId: generateSettingsDraftId,
    onOpenParamsDialog: openParamsDialog,
    onSave: saveSettingsDraft,
    onReload: reloadSettingsConfig
  }

  return {
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
    defaultAgentId: agents.agentsList?.defaultId,
    agentsLoading: agents.loading,
    agentsError: agents.error,
    agentsCreating: agents.creating,
    selectAgent: agents.setSelectedAgentId,
    createDialogOpen,
    createDialogError,
    openCreateDialog,
    closeCreateDialog,
    submitCreateAgent: handleCreateAgent,
    personaTabProps,
    memoryTabProps,
    toolsTabProps,
    skillsTabProps,
    settingsTabProps,
    paramsDialogOpen,
    paramsDialogError,
    paramsDialogInitialValue: settingsDraft.paramsJson,
    closeParamsDialog,
    submitParamsDialog
  }
}
