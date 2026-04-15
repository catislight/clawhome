import { describe, expect, it } from 'vitest'

import { stripReasoningTagsFromText } from '../renderer/src/shared/text/reasoning-tags'

describe('stripReasoningTagsFromText', () => {
  it('strips think/final tags from visible text', () => {
    const input = '<think>internal reasoning</think>\n<final>Hello</final>'
    expect(stripReasoningTagsFromText(input)).toBe('Hello')
  })

  it('strips multiple reasoning blocks', () => {
    const input = '<think>first</think>A<think>second</think>B'
    expect(stripReasoningTagsFromText(input)).toBe('AB')
  })

  it('keeps tags inside fenced code blocks', () => {
    const input = '```xml\n<final>42</final>\n<think>reasoning</think>\n```'
    expect(stripReasoningTagsFromText(input)).toBe(input)
  })

  it('keeps tags inside inline code while stripping real tags outside', () => {
    const input = '`<final>` in code, <final>visible</final> outside'
    expect(stripReasoningTagsFromText(input)).toBe('`<final>` in code, visible outside')
  })

  it('preserve mode keeps text from unfinished think blocks', () => {
    const input = 'Before <think>unclosed content after'
    expect(stripReasoningTagsFromText(input, { mode: 'preserve' })).toBe(
      'Before unclosed content after'
    )
  })
})
