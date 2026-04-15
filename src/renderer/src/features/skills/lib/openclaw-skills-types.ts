export type OpenClawSkillStatusEntry = {
  name: string
  description: string
  source: string
  bundled: boolean
  filePath: string
  baseDir: string
  skillKey: string
  disabled: boolean
  eligible: boolean
}

export type OpenClawSkillStatusReport = {
  workspaceDir: string
  managedSkillsDir: string
  skills: OpenClawSkillStatusEntry[]
}

export type OpenClawSkillCategory = 'system' | 'custom'
