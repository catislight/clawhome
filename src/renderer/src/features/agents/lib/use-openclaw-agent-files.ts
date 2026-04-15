import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import {
  getOpenClawAgentFile,
  listOpenClawAgentFiles,
  setOpenClawAgentFile
} from '@/features/agents/lib/openclaw-agents-api'
import {
  OPENCLAW_AGENT_FILE_NAME_PRIORITY,
  type OpenClawAgentFileEntry
} from '@/features/agents/lib/openclaw-agents-types'
import { translateWithAppLanguage } from '@/shared/i18n/app-i18n'

type UseOpenClawAgentFilesOptions = {
  instanceId: string | null
  agentId: string | null
  enabled?: boolean
}

type UseOpenClawAgentFilesResult = {
  loading: boolean
  saving: boolean
  error: string | null
  workspace: string
  files: OpenClawAgentFileEntry[]
  activeFileName: string | null
  activeFileDraft: string
  activeFileBase: string
  activeFileDirty: boolean
  activeFileMissing: boolean
  selectFile: (fileName: string) => void
  updateActiveDraft: (content: string) => void
  resetActiveDraft: () => void
  reloadFiles: () => Promise<void>
  reloadActiveFile: () => Promise<void>
  saveActiveFile: () => Promise<void>
}

function sortAgentFiles(entries: OpenClawAgentFileEntry[]): OpenClawAgentFileEntry[] {
  const priorityIndexByName = new Map<string, number>(
    OPENCLAW_AGENT_FILE_NAME_PRIORITY.map((name, index) => [name, index])
  )

  return [...entries].sort((left, right) => {
    const leftPriority = priorityIndexByName.get(left.name) ?? Number.MAX_SAFE_INTEGER
    const rightPriority = priorityIndexByName.get(right.name) ?? Number.MAX_SAFE_INTEGER

    if (leftPriority !== rightPriority) {
      return leftPriority - rightPriority
    }

    return left.name.localeCompare(right.name)
  })
}

function resolvePreferredFileName(
  files: OpenClawAgentFileEntry[],
  currentFileName: string | null
): string | null {
  if (currentFileName && files.some((file) => file.name === currentFileName)) {
    return currentFileName
  }

  for (const priorityName of OPENCLAW_AGENT_FILE_NAME_PRIORITY) {
    const matchedFile = files.find((file) => file.name === priorityName)
    if (matchedFile) {
      return matchedFile.name
    }
  }

  return files[0]?.name ?? null
}

export function useOpenClawAgentFiles({
  instanceId,
  agentId,
  enabled = true
}: UseOpenClawAgentFilesOptions): UseOpenClawAgentFilesResult {
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [workspace, setWorkspace] = useState('')
  const [files, setFiles] = useState<OpenClawAgentFileEntry[]>([])
  const [activeFileName, setActiveFileName] = useState<string | null>(null)
  const [fileBaseByName, setFileBaseByName] = useState<Record<string, string>>({})
  const [fileDraftByName, setFileDraftByName] = useState<Record<string, string>>({})
  const requestIdRef = useRef(0)

  const activeFileEntry = useMemo(
    () => (activeFileName ? (files.find((file) => file.name === activeFileName) ?? null) : null),
    [activeFileName, files]
  )
  const activeFileBase = activeFileName ? (fileBaseByName[activeFileName] ?? '') : ''
  const activeFileDraft = activeFileName ? (fileDraftByName[activeFileName] ?? activeFileBase) : ''
  const activeFileDirty = Boolean(activeFileName) && activeFileDraft !== activeFileBase
  const activeFileMissing = Boolean(activeFileEntry?.missing)

  const loadFileContent = useCallback(
    async (
      fileName: string,
      options?: { force?: boolean; preserveDraft?: boolean }
    ): Promise<void> => {
      if (!enabled || !instanceId || !agentId) {
        return
      }

      if (!options?.force && Object.prototype.hasOwnProperty.call(fileBaseByName, fileName)) {
        return
      }

      setLoading(true)
      setError(null)

      try {
        const result = await getOpenClawAgentFile(instanceId, agentId, fileName)
        const content = result.file.content ?? ''

        setFiles((currentFiles) => {
          const existingIndex = currentFiles.findIndex((file) => file.name === fileName)
          if (existingIndex === -1) {
            return sortAgentFiles([...currentFiles, result.file])
          }

          const nextFiles = [...currentFiles]
          nextFiles[existingIndex] = result.file
          return sortAgentFiles(nextFiles)
        })

        setFileBaseByName((current) => ({
          ...current,
          [fileName]: content
        }))

        setFileDraftByName((current) => {
          const preserveDraft = options?.preserveDraft ?? true
          if (
            preserveDraft &&
            Object.prototype.hasOwnProperty.call(current, fileName) &&
            current[fileName] !== (fileBaseByName[fileName] ?? '')
          ) {
            return current
          }

          return {
            ...current,
            [fileName]: content
          }
        })
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : translateWithAppLanguage('agents.error.loadAgentFileFailed')
        )
      } finally {
        setLoading(false)
      }
    },
    [agentId, enabled, fileBaseByName, instanceId]
  )

  const reloadFiles = useCallback(async (): Promise<void> => {
    if (!enabled || !instanceId || !agentId) {
      return
    }

    const requestId = requestIdRef.current + 1
    requestIdRef.current = requestId
    setLoading(true)
    setError(null)

    try {
      const result = await listOpenClawAgentFiles(instanceId, agentId)
      if (requestId !== requestIdRef.current) {
        return
      }

      const nextFiles = sortAgentFiles(result.files)
      setWorkspace(result.workspace)
      setFiles(nextFiles)
      setActiveFileName((currentFileName) => resolvePreferredFileName(nextFiles, currentFileName))
    } catch (loadError) {
      if (requestId === requestIdRef.current) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : translateWithAppLanguage('agents.error.loadAgentFileListFailed')
        )
      }
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false)
      }
    }
  }, [agentId, enabled, instanceId])

  useEffect(() => {
    if (!enabled || !instanceId || !agentId) {
      requestIdRef.current += 1
      setLoading(false)
      setSaving(false)
      setError(null)
      setWorkspace('')
      setFiles([])
      setActiveFileName(null)
      setFileBaseByName({})
      setFileDraftByName({})
      return
    }

    // Agent scope changed: clear per-file cache keyed by file name to avoid stale
    // drafts/content leaking across different agents with same file names.
    requestIdRef.current += 1
    setLoading(false)
    setSaving(false)
    setError(null)
    setWorkspace('')
    setFiles([])
    setActiveFileName(null)
    setFileBaseByName({})
    setFileDraftByName({})

    void reloadFiles()
  }, [agentId, enabled, instanceId, reloadFiles])

  useEffect(() => {
    if (!activeFileName || !enabled || !instanceId || !agentId) {
      return
    }

    void loadFileContent(activeFileName, { preserveDraft: true })
  }, [activeFileName, agentId, enabled, instanceId, loadFileContent])

  const reloadActiveFile = useCallback(async (): Promise<void> => {
    if (!activeFileName) {
      return
    }
    await loadFileContent(activeFileName, { force: true, preserveDraft: false })
  }, [activeFileName, loadFileContent])

  const saveActiveFile = useCallback(async (): Promise<void> => {
    if (!enabled || !instanceId || !agentId || !activeFileName) {
      return
    }

    setSaving(true)
    setError(null)

    try {
      const content = activeFileDraft
      const result = await setOpenClawAgentFile(instanceId, agentId, activeFileName, content)

      setFiles((currentFiles) => {
        const existingIndex = currentFiles.findIndex((file) => file.name === activeFileName)
        if (existingIndex === -1) {
          return sortAgentFiles([...currentFiles, result.file])
        }

        const nextFiles = [...currentFiles]
        nextFiles[existingIndex] = result.file
        return sortAgentFiles(nextFiles)
      })

      setFileBaseByName((current) => ({
        ...current,
        [activeFileName]: content
      }))
      setFileDraftByName((current) => ({
        ...current,
        [activeFileName]: content
      }))
    } catch (saveError) {
      const fallbackError = translateWithAppLanguage('agents.error.saveAgentFileFailed')
      setError(saveError instanceof Error ? saveError.message : fallbackError)
      throw saveError instanceof Error ? saveError : new Error(fallbackError)
    } finally {
      setSaving(false)
    }
  }, [activeFileDraft, activeFileName, agentId, enabled, instanceId])

  const selectFile = useCallback((fileName: string) => {
    setActiveFileName(fileName)
  }, [])

  const updateActiveDraft = useCallback(
    (content: string) => {
      if (!activeFileName) {
        return
      }

      setFileDraftByName((current) => ({
        ...current,
        [activeFileName]: content
      }))
    },
    [activeFileName]
  )

  const resetActiveDraft = useCallback(() => {
    if (!activeFileName) {
      return
    }

    setFileDraftByName((current) => ({
      ...current,
      [activeFileName]: fileBaseByName[activeFileName] ?? ''
    }))
  }, [activeFileName, fileBaseByName])

  return {
    loading,
    saving,
    error,
    workspace,
    files,
    activeFileName,
    activeFileDraft,
    activeFileBase,
    activeFileDirty,
    activeFileMissing,
    selectFile,
    updateActiveDraft,
    resetActiveDraft,
    reloadFiles,
    reloadActiveFile,
    saveActiveFile
  }
}
