import { z } from 'zod'

import type { OpenClawAgentSettingsDraft } from '@/features/agents/lib/openclaw-agent-config-entry'
import { translateWithAppLanguage } from '@/shared/i18n/app-i18n'

export const AGENTS_CENTER_SETTINGS_FORM_SCHEMA: z.ZodType<OpenClawAgentSettingsDraft> = z
  .object({
    id: z.string(),
    default: z.boolean(),
    name: z.string(),
    emoji: z.string(),
    avatar: z.string(),
    workspace: z.string(),
    agentDir: z.string(),
    model: z.string(),
    paramsJson: z.string(),
    subagentsAllowAgents: z.array(z.string())
  })
  .superRefine((values, context) => {
    if (!values.id.trim()) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['id'],
        message: translateWithAppLanguage('agents.error.idRequired')
      })
    }
  })
