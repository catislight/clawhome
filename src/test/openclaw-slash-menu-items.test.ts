import type { Editor, Range } from '@tiptap/core'
import { describe, expect, it, vi } from 'vitest'

import { OPENCLAW_SLASH_MENU_ITEMS } from '../renderer/src/features/chat/lib/openclaw-slash-menu-items'

describe('openclaw slash menu items', () => {
  it('contains common openclaw commands', () => {
    expect(OPENCLAW_SLASH_MENU_ITEMS.some((item) => item.title === '/help')).toBe(true)
    expect(OPENCLAW_SLASH_MENU_ITEMS.some((item) => item.title === '/status')).toBe(true)
    expect(OPENCLAW_SLASH_MENU_ITEMS.some((item) => item.title === '/model')).toBe(true)
  })

  it('inserts the selected slash command into editor', () => {
    const statusItem = OPENCLAW_SLASH_MENU_ITEMS.find((item) => item.title === '/status')
    expect(statusItem).toBeDefined()

    const run = vi.fn()
    const insertContent = vi.fn(() => ({ run }))
    const deleteRange = vi.fn(() => ({ insertContent }))
    const focus = vi.fn(() => ({ deleteRange }))
    const chain = vi.fn(() => ({ focus }))
    const editor = { chain } as unknown as Editor
    const range = { from: 1, to: 4 } as Range

    statusItem?.command({ editor, range })

    expect(chain).toHaveBeenCalledTimes(1)
    expect(deleteRange).toHaveBeenCalledWith(range)
    expect(insertContent).toHaveBeenCalledWith([
      {
        type: 'slashCommandNode',
        attrs: {
          command: '/status',
          description: '当前状态',
          args: [],
          values: {}
        }
      },
      { type: 'text', text: ' ' }
    ])
    expect(run).toHaveBeenCalledTimes(1)
  })
})
