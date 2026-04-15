import { describe, expect, it } from 'vitest'

import {
  resolveToolEnabled,
  toggleToolInPolicy,
  type OpenClawAgentToolPolicy
} from '../renderer/src/features/agents/lib/openclaw-agent-tool-policy'
import type { OpenClawToolCatalogEntry } from '../renderer/src/features/agents/lib/openclaw-agents-types'

function createTool(overrides: Partial<OpenClawToolCatalogEntry>): OpenClawToolCatalogEntry {
  return {
    id: 'browser',
    label: 'Browser',
    description: 'Browser tool',
    source: 'core',
    defaultProfiles: [],
    ...overrides
  }
}

function createPolicy(overrides: Partial<OpenClawAgentToolPolicy>): OpenClawAgentToolPolicy {
  return {
    profile: 'full',
    profileInherited: false,
    hasAllowlist: false,
    allow: [],
    alsoAllow: [],
    deny: [],
    ...overrides
  }
}

describe('openclaw-agent-tool-policy', () => {
  it('treats full profile as unrestricted for non-optional tools', () => {
    const tool = createTool({
      id: 'gateway',
      label: 'Gateway'
    })

    expect(
      resolveToolEnabled({
        tool,
        policy: createPolicy({ profile: 'full' })
      })
    ).toBe(true)
  })

  it('keeps optional tools disabled by default in full profile', () => {
    const tool = createTool({
      id: 'workflow_tool',
      label: 'workflow_tool',
      source: 'plugin',
      optional: true
    })

    expect(
      resolveToolEnabled({
        tool,
        policy: createPolicy({ profile: 'full' })
      })
    ).toBe(false)
  })

  it('does not persist alsoAllow when toggling a default-on tool in full profile', () => {
    const tool = createTool({
      id: 'browser'
    })

    const disabled = toggleToolInPolicy({
      tool,
      policy: createPolicy({ profile: 'full' }),
      enabled: false
    })
    expect(disabled.deny).toContain('browser')

    const reEnabled = toggleToolInPolicy({
      tool,
      policy: disabled,
      enabled: true
    })
    expect(reEnabled.deny).not.toContain('browser')
    expect(reEnabled.alsoAllow).toEqual([])
  })

  it('keeps profile-based defaults for non-full profiles', () => {
    const codingTool = createTool({
      id: 'read',
      defaultProfiles: ['coding']
    })
    const webTool = createTool({
      id: 'web_search',
      defaultProfiles: []
    })
    const policy = createPolicy({ profile: 'coding' })

    expect(resolveToolEnabled({ tool: codingTool, policy })).toBe(true)
    expect(resolveToolEnabled({ tool: webTool, policy })).toBe(false)
  })
})
