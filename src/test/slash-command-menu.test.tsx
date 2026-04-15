import { render, screen, waitFor } from '@testing-library/react'
import { createRef } from 'react'
import { describe, expect, it, vi } from 'vitest'

import SlashCommandMenu, {
  type SlashMenuRef
} from '../renderer/src/features/chat/components/editor/extensions/slash-command/SlashCommandMenu'
import type { CommandItem } from '../renderer/src/features/chat/components/editor/extensions/slash-command/SlashCommand.types'

describe('SlashCommandMenu', () => {
  it('supports keyboard navigation and executes selected item', async () => {
    const handleSelect = vi.fn()
    const ref = createRef<SlashMenuRef>()
    const items: CommandItem[] = [
      {
        title: '上传文件',
        command: vi.fn()
      },
      {
        title: '清空输入',
        command: vi.fn()
      }
    ]

    render(
      <SlashCommandMenu
        ref={ref}
        items={items}
        command={handleSelect}
        clientRect={() => new DOMRect(20, 20, 0, 0)}
      />
    )

    const handledDown = ref.current?.onKeyDown({
      event: new KeyboardEvent('keydown', { key: 'ArrowDown' })
    })

    await waitFor(() => {
      expect(screen.getByText('清空输入').closest('button')).toHaveClass('bg-[#EBF4FF]')
    })

    const handledEnter = ref.current?.onKeyDown({
      event: new KeyboardEvent('keydown', { key: 'Enter' })
    })

    expect(handledDown).toBe(true)
    expect(handledEnter).toBe(true)
    expect(handleSelect).toHaveBeenCalledTimes(1)
    expect(handleSelect).toHaveBeenCalledWith(items[1])
  })
})
