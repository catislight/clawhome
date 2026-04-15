import { z } from 'zod'

import type { OpenClawInstanceGlobalConfigDraft } from '@/features/settings/lib/openclaw-instance-global-config-types'
import { translateWithAppLanguage } from '@/shared/i18n/app-i18n'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isNumericString(value: string): boolean {
  return /^-?\d+(\.\d+)?$/.test(value.trim())
}

export const SETTINGS_CENTER_FORM_SCHEMA: z.ZodType<OpenClawInstanceGlobalConfigDraft> = z
  .object({
    agentsDefaults: z.object({
      workspace: z.string(),
      repoRoot: z.string(),
      modelPrimary: z.string(),
      modelFallbacks: z.array(z.string()),
      models: z.record(
        z.string(),
        z.object({
          alias: z.string().optional(),
          params: z.record(z.string(), z.unknown()).optional()
        })
      ),
      imageModel: z
        .object({
          primary: z.string(),
          fallbacks: z.array(z.string())
        })
        .nullable(),
      pdfModel: z
        .object({
          primary: z.string(),
          fallbacks: z.array(z.string())
        })
        .nullable(),
      contextTokens: z.string(),
      maxConcurrent: z.string()
    }),
    tools: z.object({
      profile: z.string(),
      allow: z.array(z.string()),
      deny: z.array(z.string()),
      agentToAgentEnabled: z.boolean(),
      agentToAgentAllow: z.array(z.string()),
      elevatedEnabled: z.boolean(),
      elevatedAllowFromJson: z.string(),
      execHost: z.enum(['', 'sandbox', 'gateway', 'node']),
      execSecurity: z.enum(['', 'deny', 'allowlist', 'full']),
      execAsk: z.enum(['', 'off', 'on-miss', 'always']),
      execNode: z.string()
    })
  })
  .superRefine((values, context) => {
    const contextTokens = values.agentsDefaults.contextTokens.trim()
    if (contextTokens && !isNumericString(contextTokens)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['agentsDefaults', 'contextTokens'],
        message: translateWithAppLanguage('settings.error.form.contextTokensMustBeNumber')
      })
    }

    const maxConcurrent = values.agentsDefaults.maxConcurrent.trim()
    if (maxConcurrent && !isNumericString(maxConcurrent)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['agentsDefaults', 'maxConcurrent'],
        message: translateWithAppLanguage('settings.error.form.maxConcurrentMustBeNumber')
      })
    }

    const allowSet = new Set(values.tools.allow)
    const overlap = values.tools.deny.find((entry) => allowSet.has(entry))
    if (overlap) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['tools', 'deny'],
        message: translateWithAppLanguage('settings.error.form.toolsAllowDenyOverlap', {
          overlap
        })
      })
    }

    const allowFromJson = values.tools.elevatedAllowFromJson.trim()
    if (allowFromJson) {
      try {
        const parsed = JSON.parse(allowFromJson) as unknown
        if (!isRecord(parsed)) {
          throw new Error(translateWithAppLanguage('settings.error.form.elevatedAllowFromMustBeObject'))
        }
      } catch (error) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['tools', 'elevatedAllowFromJson'],
          message:
            error instanceof Error
              ? error.message
              : translateWithAppLanguage('settings.error.form.elevatedAllowFromInvalidJson')
        })
      }
    }
  })
