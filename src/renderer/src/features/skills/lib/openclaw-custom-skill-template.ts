import { OPENCLAW_SKILL_FILE_NAME } from '@/features/skills/lib/openclaw-skills-constants'
import { translateWithAppLanguage } from '@/shared/i18n/app-i18n'

export function normalizeOpenClawSkillFolderName(rawName: string): string {
  return rawName
    .trim()
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^\.+/g, '')
    .replace(/^-+/g, '')
    .replace(/-+$/g, '')
    .toLowerCase()
}

export function normalizeOpenClawWorkspaceDir(workspaceDir: string): string {
  return workspaceDir.trim().replace(/\\/g, '/').replace(/\/+$/, '')
}

export function buildOpenClawSkillFilePath(params: {
  workspaceDir: string
  normalizedName: string
}): string {
  const normalizedWorkspaceDir = normalizeOpenClawWorkspaceDir(params.workspaceDir)
  return `${normalizedWorkspaceDir}/skills/${params.normalizedName}/${OPENCLAW_SKILL_FILE_NAME}`
}

export function buildNewOpenClawSkillTemplate(params: {
  displayName: string
  normalizedName: string
}): string {
  const descriptionSuffix = translateWithAppLanguage('skills.template.descriptionSuffix')
  const bodyPlaceholder = translateWithAppLanguage('skills.template.bodyPlaceholder')

  return [
    '---',
    `name: ${JSON.stringify(params.normalizedName)}`,
    `description: ${JSON.stringify(`${params.displayName}${descriptionSuffix}`)}`,
    '---',
    '',
    `# ${params.displayName}`,
    '',
    bodyPlaceholder,
    ''
  ].join('\n')
}
