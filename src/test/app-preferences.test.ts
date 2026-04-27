import { describe, expect, it } from 'vitest'

import {
  buildMenuTriggerFromKeyboardEvent,
  buildSendKeyFromKeyboardEvent,
  DEFAULT_SKILL_MENU_TRIGGER,
  DEFAULT_SLASH_MENU_TRIGGER,
  DEFAULT_SEND_KEY,
  formatSendKeyForDisplay,
  normalizeAppLanguage,
  normalizeMenuTrigger,
  resolveChatMenuTriggers,
  normalizeSendKey
} from '../renderer/src/features/preferences/lib/app-preferences'

describe('app preferences utils', () => {
  it('normalizes language and send key with fallback', () => {
    expect(normalizeAppLanguage('en-US')).toBe('en-US')
    expect(normalizeAppLanguage('ja-JP')).toBe('zh-CN')

    expect(normalizeSendKey('mod+shift+enter')).toBe('Mod-Shift-Enter')
    expect(normalizeSendKey('')).toBe(DEFAULT_SEND_KEY)
    expect(normalizeSendKey(undefined)).toBe(DEFAULT_SEND_KEY)
  })

  it('captures keyboard event into shortcut descriptor', () => {
    expect(
      buildSendKeyFromKeyboardEvent({
        key: 'Enter',
        ctrlKey: true,
        metaKey: false,
        altKey: false,
        shiftKey: true
      })
    ).toBe('Mod-Shift-Enter')

    expect(
      buildSendKeyFromKeyboardEvent({
        key: 'Enter',
        ctrlKey: false,
        metaKey: false,
        altKey: false,
        shiftKey: false
      })
    ).toBeNull()
  })

  it('formats shortcut for display', () => {
    const label = formatSendKeyForDisplay('Mod-Enter')

    expect(label).toContain(' + ')
    expect(label).toMatch(/Return|Enter/)
  })

  it('normalizes menu triggers and resolves conflicts', () => {
    expect(normalizeMenuTrigger('  @', DEFAULT_SLASH_MENU_TRIGGER)).toBe('@')
    expect(normalizeMenuTrigger('', DEFAULT_SKILL_MENU_TRIGGER)).toBe(DEFAULT_SKILL_MENU_TRIGGER)

    expect(
      resolveChatMenuTriggers({
        slashMenuTrigger: '#',
        skillMenuTrigger: '#'
      })
    ).toEqual({
      slashMenuTrigger: '#',
      skillMenuTrigger: '/'
    })
  })

  it('captures keyboard event into menu trigger', () => {
    expect(
      buildMenuTriggerFromKeyboardEvent({
        key: '$',
        ctrlKey: false,
        metaKey: false,
        altKey: false
      })
    ).toBe('$')

    expect(
      buildMenuTriggerFromKeyboardEvent({
        key: '$',
        ctrlKey: true,
        metaKey: false,
        altKey: false
      })
    ).toBeNull()

    expect(
      buildMenuTriggerFromKeyboardEvent({
        key: 'Enter',
        ctrlKey: false,
        metaKey: false,
        altKey: false
      })
    ).toBeNull()

    expect(
      buildMenuTriggerFromKeyboardEvent({
        key: ' ',
        ctrlKey: false,
        metaKey: false,
        altKey: false
      })
    ).toBeNull()
  })
})
