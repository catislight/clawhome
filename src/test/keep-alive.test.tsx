import { fireEvent, render, screen } from '@testing-library/react'
import { useEffect, useState } from 'react'
import { describe, expect, it, vi } from 'vitest'

import KeepAlive from '../renderer/src/shared/layout/keep-alive'

function KeepAliveHarness(): React.JSX.Element {
  const [active, setActive] = useState(true)

  return (
    <div>
      <button type="button" onClick={() => setActive((current) => !current)}>
        toggle-active
      </button>

      <KeepAlive cacheKey="home" active={active}>
        <input aria-label="home-input" defaultValue="draft-message" />
      </KeepAlive>
    </div>
  )
}

describe('KeepAlive', () => {
  it('keeps child state after deactivation and reactivation', () => {
    render(<KeepAliveHarness />)

    const input = screen.getByLabelText('home-input') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'persisted-draft' } })

    fireEvent.click(screen.getByRole('button', { name: 'toggle-active' }))
    fireEvent.click(screen.getByRole('button', { name: 'toggle-active' }))

    expect((screen.getByLabelText('home-input') as HTMLInputElement).value).toBe('persisted-draft')
  })

  it('supports switching cache keys when maxEntries is limited', () => {
    const mounts = vi.fn()

    function Child({ label }: { label: string }): React.JSX.Element {
      useEffect(() => {
        mounts(label)
      }, [label, mounts])

      return <div>{label}</div>
    }

    function Harness(): React.JSX.Element {
      const [activeKey, setActiveKey] = useState<'a' | 'b' | 'a-again'>('a')

      return (
        <div>
          <button type="button" onClick={() => setActiveKey('a')}>
            show-a
          </button>
          <button type="button" onClick={() => setActiveKey('b')}>
            show-b
          </button>
          <button type="button" onClick={() => setActiveKey('a-again')}>
            show-a-again
          </button>

          <KeepAlive cacheKey={activeKey.startsWith('a') ? 'a' : 'b'} active maxEntries={1}>
            <Child label={activeKey} />
          </KeepAlive>
        </div>
      )
    }

    render(<Harness />)

    fireEvent.click(screen.getByRole('button', { name: 'show-b' }))
    fireEvent.click(screen.getByRole('button', { name: 'show-a-again' }))

    expect(mounts).toHaveBeenCalledWith('a')
    expect(mounts).toHaveBeenCalledWith('b')
    expect(mounts).toHaveBeenCalledWith('a-again')
  })
})
