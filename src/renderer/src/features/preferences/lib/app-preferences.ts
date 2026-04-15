export const APP_LANGUAGE_VALUES = ['zh-CN', 'en-US'] as const

export type AppLanguage = (typeof APP_LANGUAGE_VALUES)[number]

export type AppPreferences = {
  language: AppLanguage
  sendKey: string
}

type ShortcutModifier = 'Mod' | 'Alt' | 'Shift'

type ParsedShortcut = {
  modifiers: ShortcutModifier[]
  key: string
}

const MODIFIER_ORDER: ShortcutModifier[] = ['Mod', 'Alt', 'Shift']

const MODIFIER_ALIASES: Record<string, ShortcutModifier> = {
  mod: 'Mod',
  cmd: 'Mod',
  command: 'Mod',
  ctrl: 'Mod',
  control: 'Mod',
  alt: 'Alt',
  option: 'Alt',
  shift: 'Shift'
}

const MODIFIER_KEY_NAMES = new Set(['Shift', 'Control', 'Ctrl', 'Meta', 'Alt'])

const SPECIAL_KEY_MAP: Record<string, string> = {
  enter: 'Enter',
  return: 'Enter',
  tab: 'Tab',
  esc: 'Escape',
  escape: 'Escape',
  backspace: 'Backspace',
  delete: 'Delete',
  del: 'Delete',
  space: 'Space',
  spacebar: 'Space',
  up: 'ArrowUp',
  arrowup: 'ArrowUp',
  down: 'ArrowDown',
  arrowdown: 'ArrowDown',
  left: 'ArrowLeft',
  arrowleft: 'ArrowLeft',
  right: 'ArrowRight',
  arrowright: 'ArrowRight',
  pageup: 'PageUp',
  pagedown: 'PageDown',
  home: 'Home',
  end: 'End',
  insert: 'Insert'
}

export const DEFAULT_APP_LANGUAGE: AppLanguage = 'zh-CN'
export const DEFAULT_SEND_KEY = 'Mod-Enter'

function normalizeShortcutKeyToken(token: string): string {
  const normalized = token.trim()
  if (!normalized) {
    return ''
  }

  if (normalized === ' ') {
    return 'Space'
  }

  const lower = normalized.toLowerCase()

  if (MODIFIER_ALIASES[lower]) {
    return ''
  }

  if (SPECIAL_KEY_MAP[lower]) {
    return SPECIAL_KEY_MAP[lower]
  }

  if (/^f\d{1,2}$/i.test(normalized)) {
    return normalized.toUpperCase()
  }

  if (normalized.length === 1) {
    return normalized.toUpperCase()
  }

  return `${normalized.slice(0, 1).toUpperCase()}${normalized.slice(1)}`
}

function parseShortcutDescriptor(value: string): ParsedShortcut | null {
  const tokens = value
    .split(/[+-]/)
    .map((token) => token.trim())
    .filter(Boolean)

  if (tokens.length === 0) {
    return null
  }

  const modifiers = new Set<ShortcutModifier>()
  let key = ''

  tokens.forEach((token) => {
    const alias = MODIFIER_ALIASES[token.toLowerCase()]

    if (alias) {
      modifiers.add(alias)
      return
    }

    key = normalizeShortcutKeyToken(token)
  })

  if (!key) {
    return null
  }

  return {
    modifiers: MODIFIER_ORDER.filter((modifier) => modifiers.has(modifier)),
    key
  }
}

function stringifyShortcutDescriptor(shortcut: ParsedShortcut): string {
  return [...shortcut.modifiers, shortcut.key].join('-')
}

export function isAppLanguage(value: unknown): value is AppLanguage {
  return typeof value === 'string' && APP_LANGUAGE_VALUES.some((item) => item === value)
}

export function normalizeAppLanguage(value: unknown): AppLanguage {
  if (isAppLanguage(value)) {
    return value
  }

  return DEFAULT_APP_LANGUAGE
}

export function normalizeSendKey(value: unknown): string {
  if (typeof value !== 'string') {
    return DEFAULT_SEND_KEY
  }

  const parsed = parseShortcutDescriptor(value)
  return parsed ? stringifyShortcutDescriptor(parsed) : DEFAULT_SEND_KEY
}

export function buildSendKeyFromKeyboardEvent(event: {
  key: string
  metaKey: boolean
  ctrlKey: boolean
  altKey: boolean
  shiftKey: boolean
}): string | null {
  if (!event.key || MODIFIER_KEY_NAMES.has(event.key)) {
    return null
  }

  const key = normalizeShortcutKeyToken(event.key)
  if (!key) {
    return null
  }

  const modifiers = new Set<ShortcutModifier>()

  if (event.metaKey || event.ctrlKey) {
    modifiers.add('Mod')
  }
  if (event.altKey) {
    modifiers.add('Alt')
  }
  if (event.shiftKey) {
    modifiers.add('Shift')
  }

  if (modifiers.size === 0) {
    return null
  }

  return stringifyShortcutDescriptor({
    modifiers: MODIFIER_ORDER.filter((modifier) => modifiers.has(modifier)),
    key
  })
}

function isAppleLikePlatform(): boolean {
  if (typeof navigator === 'undefined') {
    return true
  }

  return /(Mac|iPhone|iPad|iPod)/i.test(navigator.platform || navigator.userAgent)
}

export function formatSendKeyForDisplay(sendKey: string): string {
  const parsed = parseShortcutDescriptor(normalizeSendKey(sendKey))
  if (!parsed) {
    return 'Mod + Enter'
  }

  const appleLikePlatform = isAppleLikePlatform()

  const modifierLabels = parsed.modifiers.map((modifier) => {
    if (modifier === 'Mod') {
      return appleLikePlatform ? '⌘' : 'Ctrl'
    }

    if (modifier === 'Alt') {
      return appleLikePlatform ? '⌥' : 'Alt'
    }

    if (modifier === 'Shift') {
      return appleLikePlatform ? '⇧' : 'Shift'
    }

    return modifier
  })

  const keyLabelMap: Record<string, string> = {
    Enter: appleLikePlatform ? 'Return' : 'Enter',
    Escape: 'Esc',
    ArrowUp: '↑',
    ArrowDown: '↓',
    ArrowLeft: '←',
    ArrowRight: '→'
  }

  const keyLabel = keyLabelMap[parsed.key] ?? parsed.key

  return [...modifierLabels, keyLabel].join(' + ')
}

export function detectSystemLanguage(): AppLanguage {
  if (typeof navigator === 'undefined') {
    return DEFAULT_APP_LANGUAGE
  }

  const candidate = navigator.language?.toLowerCase() ?? ''
  return candidate.startsWith('zh') ? 'zh-CN' : 'en-US'
}

export function createDefaultPreferences(): AppPreferences {
  return {
    language: DEFAULT_APP_LANGUAGE,
    sendKey: DEFAULT_SEND_KEY
  }
}
