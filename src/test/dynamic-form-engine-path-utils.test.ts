import { describe, expect, it } from 'vitest'

import {
  getValueAtPath,
  hasPath,
  setValueAtPath,
  tokenizePath
} from '../renderer/src/shared/lib/dynamic-form-engine/path-utils'

describe('dynamic-form-engine/path-utils', () => {
  it('tokenizes dotted and bracket paths', () => {
    expect(tokenizePath('tools.allow[0]')).toEqual(['tools', 'allow', 0])
    expect(tokenizePath('agents.defaults["model.primary"]')).toEqual([
      'agents',
      'defaults',
      'model.primary'
    ])
  })

  it('reads nested values by path', () => {
    const source = {
      tools: {
        allow: ['read', 'edit']
      }
    }

    expect(getValueAtPath(source, 'tools.allow[1]')).toBe('edit')
    expect(getValueAtPath(source, 'tools.deny[0]')).toBeUndefined()
  })

  it('writes nested values immutably by path', () => {
    const source = {
      tools: {
        allow: ['read']
      }
    }

    const next = setValueAtPath(source, 'tools.allow[1]', 'edit')
    expect(next).toEqual({
      tools: {
        allow: ['read', 'edit']
      }
    })
    expect(source).toEqual({
      tools: {
        allow: ['read']
      }
    })
  })

  it('checks if a path exists', () => {
    const source = {
      tools: {
        deny: []
      }
    }

    expect(hasPath(source, 'tools.deny')).toBe(true)
    expect(hasPath(source, 'tools.allow')).toBe(false)
  })
})
