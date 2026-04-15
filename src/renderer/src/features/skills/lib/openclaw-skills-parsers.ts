import type {
  OpenClawSkillStatusEntry,
  OpenClawSkillStatusReport
} from '@/features/skills/lib/openclaw-skills-types'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined
}

function readBoolean(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined
}

function parseSkillStatusEntry(value: unknown): OpenClawSkillStatusEntry | null {
  if (!isRecord(value)) {
    return null
  }

  const name = readString(value.name)
  const source = readString(value.source)
  const filePath = readString(value.filePath)
  const baseDir = readString(value.baseDir)
  const skillKey = readString(value.skillKey)
  const disabled = readBoolean(value.disabled)
  const bundled =
    readBoolean(value.bundled) ??
    (source ? source.trim().toLowerCase() === 'openclaw-bundled' : false)

  if (!name || !source || !filePath || !baseDir || !skillKey || disabled === undefined) {
    return null
  }

  return {
    name,
    description: readString(value.description) ?? '',
    source,
    bundled,
    filePath,
    baseDir,
    skillKey,
    disabled,
    eligible: readBoolean(value.eligible) ?? false
  }
}

export function parseOpenClawSkillsStatusReport(
  payload: unknown
): OpenClawSkillStatusReport | null {
  if (!isRecord(payload) || !Array.isArray(payload.skills)) {
    return null
  }

  const workspaceDir = readString(payload.workspaceDir)
  const managedSkillsDir = readString(payload.managedSkillsDir)
  if (!workspaceDir || !managedSkillsDir) {
    return null
  }

  return {
    workspaceDir,
    managedSkillsDir,
    skills: payload.skills.flatMap((entry) => {
      const parsed = parseSkillStatusEntry(entry)
      return parsed ? [parsed] : []
    })
  }
}
