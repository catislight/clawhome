import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { useEffect, useRef, useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  OverflowMenu,
  type OverflowMenuItem
} from '../renderer/src/shared/ui/overflow-menu'

describe('OverflowMenu', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders a reusable action menu with animated visibility states', () => {
    const handleSelect = vi.fn()
    const items: OverflowMenuItem[] = [
      {
        key: 'configure',
        label: '连接配置',
        onSelect: handleSelect
      },
      {
        key: 'reconnect',
        label: '重新连接',
        onSelect: vi.fn()
      }
    ]

    render(<OverflowMenu items={items} />)

    fireEvent.click(screen.getByRole('button', { name: '更多操作' }))
    act(() => {
      vi.advanceTimersByTime(16)
    })

    const menu = screen.getByRole('menu')

    expect(menu).toHaveAttribute('data-state', 'open')
    expect(menu).toHaveClass('bg-white', 'p-1.5', 'duration-150')
    expect(within(menu).getByRole('menuitem', { name: '连接配置' })).toBeInTheDocument()

    fireEvent.click(within(menu).getByRole('menuitem', { name: '连接配置' }))

    expect(handleSelect).toHaveBeenCalledTimes(1)

    act(() => {
      vi.runAllTimers()
    })

    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('closes after clicking outside', () => {
    render(
      <div>
        <OverflowMenu
          items={[
            {
              key: 'configure',
              label: '连接配置',
              onSelect: vi.fn()
            }
          ]}
        />
        <button type="button">outside</button>
      </div>
    )

    fireEvent.click(screen.getByRole('button', { name: '更多操作' }))
    act(() => {
      vi.advanceTimersByTime(16)
    })
    fireEvent.mouseDown(screen.getByRole('button', { name: 'outside' }))

    act(() => {
      vi.runAllTimers()
    })

    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('supports opening to the right edge when used as a flyout menu', () => {
    render(
      <OverflowMenu
        side="right"
        align="end"
        items={[
          {
            key: 'disconnect',
            label: '断开连接',
            onSelect: vi.fn()
          }
        ]}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: '更多操作' }))
    act(() => {
      vi.advanceTimersByTime(16)
    })

    expect(screen.getByRole('menu')).toHaveClass(
      'left-[calc(100%+0.375rem)]',
      'bottom-0',
      'origin-bottom-left'
    )
  })

  it('keeps parent popover open during portal menu mousedown so menu item can trigger', () => {
    const handleSelect = vi.fn()

    function TestHost(): React.JSX.Element {
      const [panelOpen, setPanelOpen] = useState(true)
      const rootRef = useRef<HTMLDivElement | null>(null)

      useEffect(() => {
        if (!panelOpen) {
          return
        }

        const handlePointerDown = (event: MouseEvent): void => {
          if (!rootRef.current?.contains(event.target as Node)) {
            setPanelOpen(false)
          }
        }

        window.addEventListener('mousedown', handlePointerDown)
        return () => {
          window.removeEventListener('mousedown', handlePointerDown)
        }
      }, [panelOpen])

      return (
        <div>
          <button type="button">outside</button>
          {panelOpen ? (
            <div ref={rootRef} data-testid="panel">
              <OverflowMenu
                align="end"
                side="right"
                renderInPortal
                items={[
                  {
                    key: 'disconnect',
                    label: '断开连接',
                    onSelect: handleSelect
                  }
                ]}
              />
            </div>
          ) : null}
        </div>
      )
    }

    render(<TestHost />)

    fireEvent.click(screen.getByRole('button', { name: '更多操作' }))
    act(() => {
      vi.advanceTimersByTime(16)
    })

    const menu = screen.getByRole('menu')
    const action = within(menu).getByRole('menuitem', { name: '断开连接' })
    fireEvent.mouseDown(action)
    fireEvent.click(action)

    expect(handleSelect).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId('panel')).toBeInTheDocument()
  })
})
