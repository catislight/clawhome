import { describe, expect, it } from 'vitest'
import { z } from 'zod'

import {
  mapZodIssuesToValidationErrors,
  validateValuesWithSchema
} from '../renderer/src/shared/lib/dynamic-form-engine/validation'

const schema = z.object({
  agents: z.object({
    defaults: z.object({
      workspace: z.string().trim().min(1, 'workspace 不能为空')
    })
  }),
  tools: z.object({
    allow: z.array(z.string().min(1)),
    deny: z.array(z.string().min(1))
  })
})

describe('dynamic-form-engine/validation', () => {
  it('maps zod issues to field/form error buckets', () => {
    const result = schema.safeParse({
      agents: { defaults: { workspace: '' } },
      tools: { allow: [''], deny: [] }
    })

    if (result.success) {
      throw new Error('expected schema parsing to fail')
    }

    const errors = mapZodIssuesToValidationErrors(result.error.issues)
    expect(errors.fieldErrors.some((entry) => entry.path === 'agents.defaults.workspace')).toBe(true)
    expect(errors.fieldErrors.some((entry) => entry.path === 'tools.allow.0')).toBe(true)
  })

  it('returns typed success payload after validation', () => {
    const result = validateValuesWithSchema(schema, {
      agents: { defaults: { workspace: '/tmp' } },
      tools: { allow: ['read'], deny: [] }
    })

    expect(result.success).toBe(true)
    if (!result.success) {
      throw new Error('expected validation success')
    }
    expect(result.data.agents.defaults.workspace).toBe('/tmp')
  })
})
