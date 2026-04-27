import { listOpenClawSkills } from '@/features/skills/lib/openclaw-skills-api'
import type { OpenClawSkillStatusEntry } from '@/features/skills/lib/openclaw-skills-types'
import {
  filterOpenClawSkillsByCategory,
  sortOpenClawSkillsByName
} from '@/features/skills/lib/openclaw-skills-selectors'

function normalizeSkillNames(skillNames: string[]): string[] {
  const seen = new Set<string>()

  return skillNames.flatMap((skillName) => {
    const normalized = skillName.trim()
    if (!normalized) {
      return []
    }

    const key = normalized.toLowerCase()
    if (seen.has(key)) {
      return []
    }
    seen.add(key)
    return [normalized]
  })
}

export function resolveCustomSkillNames(skills: OpenClawSkillStatusEntry[]): string[] {
  return normalizeSkillNames(
    sortOpenClawSkillsByName(filterOpenClawSkillsByCategory(skills, 'custom')).map(
      (skill) => skill.name
    )
  )
}

export async function requestChatCustomSkillNames(params: {
  instanceId: string
  agentId?: string
}): Promise<string[]> {
  const report = await listOpenClawSkills(params.instanceId, {
    ...(params.agentId ? { agentId: params.agentId } : {})
  })

  return resolveCustomSkillNames(report.skills)
}
