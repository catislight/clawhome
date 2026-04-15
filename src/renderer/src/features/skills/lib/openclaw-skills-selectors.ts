import type {
  OpenClawSkillCategory,
  OpenClawSkillStatusEntry
} from '@/features/skills/lib/openclaw-skills-types'
import {
  OPENCLAW_SKILLS_NAME_SORT_LOCALE,
  OPENCLAW_SKILLS_NAME_SORT_OPTIONS
} from '@/features/skills/lib/openclaw-skills-constants'

export function sortOpenClawSkillsByName(
  skills: OpenClawSkillStatusEntry[]
): OpenClawSkillStatusEntry[] {
  return [...skills].sort((left, right) =>
    left.name.localeCompare(
      right.name,
      OPENCLAW_SKILLS_NAME_SORT_LOCALE,
      OPENCLAW_SKILLS_NAME_SORT_OPTIONS
    )
  )
}

export function resolveOpenClawSkillCategory(
  skill: Pick<OpenClawSkillStatusEntry, 'bundled'>
): OpenClawSkillCategory {
  return skill.bundled ? 'system' : 'custom'
}

export function filterOpenClawSkillsByCategory(
  skills: OpenClawSkillStatusEntry[],
  category: OpenClawSkillCategory
): OpenClawSkillStatusEntry[] {
  return skills.filter((skill) => resolveOpenClawSkillCategory(skill) === category)
}

export function resolvePreferredOpenClawSkillCategory(
  skills: OpenClawSkillStatusEntry[],
  currentCategory: OpenClawSkillCategory
): OpenClawSkillCategory {
  if (currentCategory === 'custom') {
    return 'custom'
  }

  const hasSystem = skills.some((skill) => resolveOpenClawSkillCategory(skill) === 'system')
  const hasCustom = skills.some((skill) => resolveOpenClawSkillCategory(skill) === 'custom')

  if (hasSystem) {
    return 'system'
  }

  if (hasCustom) {
    return 'custom'
  }

  return 'system'
}

export function resolvePreferredOpenClawSkillKey(
  skills: OpenClawSkillStatusEntry[],
  category: OpenClawSkillCategory,
  currentSkillKey: string | null
): string | null {
  const categorySkills = filterOpenClawSkillsByCategory(skills, category)
  if (currentSkillKey && categorySkills.some((skill) => skill.skillKey === currentSkillKey)) {
    return currentSkillKey
  }

  return categorySkills[0]?.skillKey ?? null
}
