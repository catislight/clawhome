import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import type { SshConnectionFormValues } from '@/features/instances/model/ssh-connection'
import {
  buildNewOpenClawSkillTemplate,
  buildOpenClawSkillFilePath,
  normalizeOpenClawSkillFolderName,
  normalizeOpenClawWorkspaceDir
} from '@/features/skills/lib/openclaw-custom-skill-template'
import {
  deleteOpenClawCustomSkill,
  getOpenClawSkillFileContent,
  listOpenClawSkills,
  setOpenClawSkillFileContent,
  updateOpenClawSkillEnabled
} from '@/features/skills/lib/openclaw-skills-api'
import {
  filterOpenClawSkillsByCategory,
  resolvePreferredOpenClawSkillCategory,
  resolvePreferredOpenClawSkillKey,
  sortOpenClawSkillsByName
} from '@/features/skills/lib/openclaw-skills-selectors'
import type {
  OpenClawSkillCategory,
  OpenClawSkillStatusEntry
} from '@/features/skills/lib/openclaw-skills-types'
import { translateWithAppLanguage } from '@/shared/i18n/app-i18n'

type UseOpenClawSkillsCenterOptions = {
  instanceId: string | null
  connectionConfig: SshConnectionFormValues | null
  enabled?: boolean
}

type LoadSkillContentOptions = {
  force?: boolean
  preserveDraft?: boolean
}

type UseOpenClawSkillsCenterResult = {
  loading: boolean
  loadingContent: boolean
  savingContent: boolean
  updatingEnabled: boolean
  creatingSkill: boolean
  deletingSkill: boolean
  error: string | null
  activeCategory: OpenClawSkillCategory
  visibleSkills: OpenClawSkillStatusEntry[]
  selectedSkillKey: string | null
  selectedSkill: OpenClawSkillStatusEntry | null
  selectedSkillContentDraft: string
  selectedSkillContentDirty: boolean
  setActiveCategory: (category: OpenClawSkillCategory) => void
  selectSkill: (skillKey: string) => void
  updateSelectedSkillContentDraft: (content: string) => void
  resetSelectedSkillContentDraft: () => void
  reloadSkills: () => Promise<void>
  reloadSelectedSkillContent: () => Promise<void>
  saveSelectedSkillContent: () => Promise<void>
  setSelectedSkillEnabled: (enabled: boolean) => Promise<void>
  createCustomSkill: (name: string) => Promise<void>
  deleteSelectedCustomSkill: () => Promise<void>
}

export function useOpenClawSkillsCenter({
  instanceId,
  connectionConfig,
  enabled = true
}: UseOpenClawSkillsCenterOptions): UseOpenClawSkillsCenterResult {
  const [loading, setLoading] = useState(false)
  const [loadingContent, setLoadingContent] = useState(false)
  const [savingContent, setSavingContent] = useState(false)
  const [updatingEnabled, setUpdatingEnabled] = useState(false)
  const [creatingSkill, setCreatingSkill] = useState(false)
  const [deletingSkill, setDeletingSkill] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [workspaceDir, setWorkspaceDir] = useState('')
  const [activeCategory, setActiveCategoryState] = useState<OpenClawSkillCategory>('system')
  const [skills, setSkills] = useState<OpenClawSkillStatusEntry[]>([])
  const [selectedSkillKey, setSelectedSkillKey] = useState<string | null>(null)
  const [contentBaseByKey, setContentBaseByKey] = useState<Record<string, string>>({})
  const [contentDraftByKey, setContentDraftByKey] = useState<Record<string, string>>({})
  const listRequestIdRef = useRef(0)
  const contentRequestIdRef = useRef(0)

  const selectedSkill = useMemo(
    () =>
      selectedSkillKey
        ? (skills.find((skill) => skill.skillKey === selectedSkillKey) ?? null)
        : null,
    [selectedSkillKey, skills]
  )

  const visibleSkills = useMemo(
    () => filterOpenClawSkillsByCategory(skills, activeCategory),
    [activeCategory, skills]
  )

  const selectedSkillContentBase = selectedSkillKey
    ? (contentBaseByKey[selectedSkillKey] ?? '')
    : ''
  const selectedSkillContentDraft = selectedSkillKey
    ? (contentDraftByKey[selectedSkillKey] ?? selectedSkillContentBase)
    : ''
  const selectedSkillContentDirty =
    Boolean(selectedSkillKey) && selectedSkillContentDraft !== selectedSkillContentBase

  const hasSkillKey = useCallback(
    (candidate: string): boolean =>
      skills.some(
        (skill) => skill.skillKey.trim().toLowerCase() === candidate.trim().toLowerCase()
      ),
    [skills]
  )

  const loadSkillContent = useCallback(
    async (skill: OpenClawSkillStatusEntry, options?: LoadSkillContentOptions): Promise<void> => {
      if (!enabled || !connectionConfig) {
        return
      }

      if (
        !options?.force &&
        Object.prototype.hasOwnProperty.call(contentBaseByKey, skill.skillKey)
      ) {
        return
      }

      const previousBase = contentBaseByKey[skill.skillKey] ?? ''
      const requestId = contentRequestIdRef.current + 1
      contentRequestIdRef.current = requestId
      setLoadingContent(true)
      setError(null)

      try {
        const content = await getOpenClawSkillFileContent(connectionConfig, skill.filePath)
        if (requestId !== contentRequestIdRef.current) {
          return
        }

        setContentBaseByKey((current) => ({
          ...current,
          [skill.skillKey]: content
        }))

        setContentDraftByKey((current) => {
          const preserveDraft = options?.preserveDraft ?? true
          if (
            preserveDraft &&
            Object.prototype.hasOwnProperty.call(current, skill.skillKey) &&
            current[skill.skillKey] !== previousBase
          ) {
            return current
          }

          return {
            ...current,
            [skill.skillKey]: content
          }
        })
      } catch (contentError) {
        if (requestId === contentRequestIdRef.current) {
          setError(
            contentError instanceof Error
              ? contentError.message
              : translateWithAppLanguage('skills.error.contentLoadFailed')
          )
        }
      } finally {
        if (requestId === contentRequestIdRef.current) {
          setLoadingContent(false)
        }
      }
    },
    [connectionConfig, contentBaseByKey, enabled]
  )

  const reloadSkills = useCallback(async (): Promise<void> => {
    if (!enabled || !instanceId) {
      return
    }

    const requestId = listRequestIdRef.current + 1
    listRequestIdRef.current = requestId
    setLoading(true)
    setError(null)

    try {
      const report = await listOpenClawSkills(instanceId)
      if (requestId !== listRequestIdRef.current) {
        return
      }

      const sortedSkills = sortOpenClawSkillsByName(report.skills)
      const nextCategory = resolvePreferredOpenClawSkillCategory(sortedSkills, activeCategory)
      setWorkspaceDir(report.workspaceDir)
      setSkills(sortedSkills)
      setActiveCategoryState(nextCategory)
      setSelectedSkillKey((currentSkillKey) =>
        resolvePreferredOpenClawSkillKey(sortedSkills, nextCategory, currentSkillKey)
      )
    } catch (loadError) {
      if (requestId === listRequestIdRef.current) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : translateWithAppLanguage('skills.error.listLoadFailed')
        )
      }
    } finally {
      if (requestId === listRequestIdRef.current) {
        setLoading(false)
      }
    }
  }, [activeCategory, enabled, instanceId])

  useEffect(() => {
    if (!enabled || !instanceId) {
      listRequestIdRef.current += 1
      contentRequestIdRef.current += 1
      setLoading(false)
      setLoadingContent(false)
      setSavingContent(false)
      setUpdatingEnabled(false)
      setCreatingSkill(false)
      setDeletingSkill(false)
      setError(null)
      setWorkspaceDir('')
      setActiveCategoryState('system')
      setSkills([])
      setSelectedSkillKey(null)
      setContentBaseByKey({})
      setContentDraftByKey({})
      return
    }

    void reloadSkills()
  }, [enabled, instanceId, reloadSkills])

  useEffect(() => {
    if (!selectedSkill) {
      return
    }

    void loadSkillContent(selectedSkill, { preserveDraft: true })
  }, [loadSkillContent, selectedSkill])

  const setActiveCategory = useCallback(
    (category: OpenClawSkillCategory) => {
      setActiveCategoryState(category)
      setSelectedSkillKey((currentSkillKey) =>
        resolvePreferredOpenClawSkillKey(skills, category, currentSkillKey)
      )
    },
    [skills]
  )

  const reloadSelectedSkillContent = useCallback(async (): Promise<void> => {
    if (!selectedSkill) {
      return
    }

    await loadSkillContent(selectedSkill, { force: true, preserveDraft: false })
  }, [loadSkillContent, selectedSkill])

  const saveSelectedSkillContent = useCallback(async (): Promise<void> => {
    if (!enabled || !connectionConfig || !selectedSkill || !selectedSkillKey) {
      return
    }

    setSavingContent(true)
    setError(null)

    try {
      const content = selectedSkillContentDraft
      await setOpenClawSkillFileContent(connectionConfig, selectedSkill.filePath, content)
      setContentBaseByKey((current) => ({
        ...current,
        [selectedSkillKey]: content
      }))
      setContentDraftByKey((current) => ({
        ...current,
        [selectedSkillKey]: content
      }))
    } catch (saveError) {
      const message =
        saveError instanceof Error
          ? saveError.message
          : translateWithAppLanguage('skills.error.contentSaveFailed')
      setError(message)
      throw saveError instanceof Error ? saveError : new Error(message)
    } finally {
      setSavingContent(false)
    }
  }, [connectionConfig, enabled, selectedSkill, selectedSkillContentDraft, selectedSkillKey])

  const setSelectedSkillEnabled = useCallback(
    async (enabledValue: boolean): Promise<void> => {
      if (!enabled || !instanceId || !selectedSkill) {
        return
      }

      setUpdatingEnabled(true)
      setError(null)

      try {
        await updateOpenClawSkillEnabled(instanceId, selectedSkill.skillKey, enabledValue)
        setSkills((currentSkills) =>
          currentSkills.map((skill) =>
            skill.skillKey === selectedSkill.skillKey
              ? { ...skill, disabled: !enabledValue }
              : skill
          )
        )
      } catch (updateError) {
        const message =
          updateError instanceof Error
            ? updateError.message
            : translateWithAppLanguage('skills.error.statusUpdateFailed')
        setError(message)
        throw updateError instanceof Error ? updateError : new Error(message)
      } finally {
        setUpdatingEnabled(false)
      }
    },
    [enabled, instanceId, selectedSkill]
  )

  const createCustomSkill = useCallback(
    async (name: string): Promise<void> => {
      if (!enabled || !instanceId || !connectionConfig) {
        throw new Error(translateWithAppLanguage('skills.error.createUnavailable'))
      }

      const displayName = name.trim()
      if (!displayName) {
        throw new Error(translateWithAppLanguage('skills.error.createNameRequired'))
      }

      const normalizedName = normalizeOpenClawSkillFolderName(displayName)
      if (!normalizedName) {
        throw new Error(translateWithAppLanguage('skills.error.createNameInvalid'))
      }

      if (hasSkillKey(normalizedName)) {
        throw new Error(translateWithAppLanguage('skills.error.createAlreadyExists'))
      }

      const normalizedWorkspaceDir = normalizeOpenClawWorkspaceDir(workspaceDir)
      if (!normalizedWorkspaceDir) {
        throw new Error(translateWithAppLanguage('skills.error.createWorkspaceUnavailable'))
      }

      const skillFilePath = buildOpenClawSkillFilePath({
        workspaceDir: normalizedWorkspaceDir,
        normalizedName
      })
      const skillTemplate = buildNewOpenClawSkillTemplate({
        displayName,
        normalizedName
      })

      setCreatingSkill(true)
      setError(null)

      try {
        await setOpenClawSkillFileContent(connectionConfig, skillFilePath, skillTemplate)
        await reloadSkills()
        setActiveCategoryState('custom')
        setSelectedSkillKey(normalizedName)
      } catch (createError) {
        const message =
          createError instanceof Error
            ? createError.message
            : translateWithAppLanguage('skills.error.createFailed')
        setError(message)
        throw createError instanceof Error ? createError : new Error(message)
      } finally {
        setCreatingSkill(false)
      }
    },
    [connectionConfig, enabled, hasSkillKey, instanceId, reloadSkills, workspaceDir]
  )

  const deleteSelectedCustomSkill = useCallback(async (): Promise<void> => {
    if (!enabled || !instanceId || !connectionConfig || !selectedSkill) {
      throw new Error(translateWithAppLanguage('skills.error.deleteUnavailable'))
    }

    if (selectedSkill.bundled) {
      throw new Error(translateWithAppLanguage('skills.error.deleteBundledNotAllowed'))
    }

    setDeletingSkill(true)
    setError(null)

    try {
      await deleteOpenClawCustomSkill(connectionConfig, selectedSkill)
      setContentBaseByKey((current) => {
        const next = { ...current }
        delete next[selectedSkill.skillKey]
        return next
      })
      setContentDraftByKey((current) => {
        const next = { ...current }
        delete next[selectedSkill.skillKey]
        return next
      })
      await reloadSkills()
      setActiveCategoryState('custom')
    } catch (deleteError) {
      const message =
        deleteError instanceof Error
          ? deleteError.message
          : translateWithAppLanguage('skills.error.deleteFailed')
      setError(message)
      throw deleteError instanceof Error ? deleteError : new Error(message)
    } finally {
      setDeletingSkill(false)
    }
  }, [connectionConfig, enabled, instanceId, reloadSkills, selectedSkill])

  return {
    loading,
    loadingContent,
    savingContent,
    updatingEnabled,
    creatingSkill,
    deletingSkill,
    error,
    activeCategory,
    visibleSkills,
    selectedSkillKey,
    selectedSkill,
    selectedSkillContentDraft,
    selectedSkillContentDirty,
    setActiveCategory,
    selectSkill: (skillKey: string) => setSelectedSkillKey(skillKey),
    updateSelectedSkillContentDraft: (content: string) => {
      if (!selectedSkillKey) {
        return
      }

      setContentDraftByKey((current) => ({
        ...current,
        [selectedSkillKey]: content
      }))
    },
    resetSelectedSkillContentDraft: () => {
      if (!selectedSkillKey) {
        return
      }

      setContentDraftByKey((current) => ({
        ...current,
        [selectedSkillKey]: contentBaseByKey[selectedSkillKey] ?? ''
      }))
    },
    reloadSkills,
    reloadSelectedSkillContent,
    saveSelectedSkillContent,
    setSelectedSkillEnabled,
    createCustomSkill,
    deleteSelectedCustomSkill
  }
}
