import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'

import { useAppI18n } from '@/shared/i18n/app-i18n'
import { cn } from '@/shared/lib/utils'
import type { SlashMenuProps, CommandItem } from './SlashCommand.types'

export interface SlashMenuRef {
  onKeyDown: (props: { event: KeyboardEvent }) => boolean
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

const ITEM_HEIGHT = 36
const MENU_MIN_WIDTH = 240
const MENU_MAX_WIDTH = 560
const VIEWPORT_PADDING = 12

const SlashMenu = forwardRef<SlashMenuRef, SlashMenuProps>(function SlashMenu(props, ref) {
  const { t } = useAppI18n()
  const { items, command, clientRect, anchorRect } = props
  const [selectedIndex, setSelectedIndex] = useState(0)
  const menuListRef = useRef<HTMLDivElement | null>(null)
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([])
  const safeSelectedIndex = selectedIndex < items.length ? selectedIndex : 0

  useImperativeHandle(
    ref,
    () => ({
      onKeyDown: ({ event }) => {
        if (items.length === 0) {
          return false
        }

        if (event.key === 'ArrowUp') {
          setSelectedIndex((prev) => (prev - 1 + items.length) % items.length)
          return true
        }
        if (event.key === 'ArrowDown') {
          setSelectedIndex((prev) => (prev + 1) % items.length)
          return true
        }
        if (event.key === 'Enter') {
          const item = items[safeSelectedIndex]
          if (item) {
            command(item)
          }
          return true
        }
        return false
      }
    }),
    [command, items, safeSelectedIndex]
  )

  useEffect(() => {
    if (items.length === 0) {
      return
    }

    const container = menuListRef.current
    const activeItem = itemRefs.current[safeSelectedIndex]
    if (!container || !activeItem) {
      return
    }

    const containerTop = container.scrollTop
    const containerBottom = containerTop + container.clientHeight
    const itemTop = activeItem.offsetTop
    const itemBottom = itemTop + activeItem.offsetHeight
    const padding = 4

    if (itemTop < containerTop) {
      container.scrollTop = Math.max(itemTop - padding, 0)
      return
    }

    if (itemBottom > containerBottom) {
      container.scrollTop = itemBottom - container.clientHeight + padding
    }
  }, [items.length, safeSelectedIndex])

  const floatingStyle = useMemo(() => {
    const anchor = anchorRect?.()
    const rect = clientRect?.()
    const itemCount = Math.max(items.length, 1)
    const estimatedHeight = Math.min(itemCount * ITEM_HEIGHT + 12, 240)

    if (anchor) {
      const estimatedWidth = Math.max(MENU_MIN_WIDTH, Math.min(MENU_MAX_WIDTH, anchor.width * 1.5))
      const maxLeft = window.innerWidth - estimatedWidth - VIEWPORT_PADDING
      const left = clamp(anchor.left, VIEWPORT_PADDING, maxLeft)
      const preferredTop = anchor.top - estimatedHeight - 8
      const top = clamp(
        preferredTop,
        VIEWPORT_PADDING,
        window.innerHeight - estimatedHeight - VIEWPORT_PADDING
      )

      return { left, top }
    }

    if (!rect) {
      return {
        left: VIEWPORT_PADDING,
        top: VIEWPORT_PADDING
      }
    }

    const estimatedWidth = Math.max(MENU_MIN_WIDTH, Math.min(MENU_MAX_WIDTH, rect.width * 1.5))
    const maxLeft = window.innerWidth - estimatedWidth - VIEWPORT_PADDING
    const left = clamp(rect.left, VIEWPORT_PADDING, maxLeft)
    const preferredTop = rect.bottom + 8
    const fallbackTop = rect.top - estimatedHeight - 8
    const top =
      preferredTop + estimatedHeight <= window.innerHeight - VIEWPORT_PADDING
        ? preferredTop
        : clamp(
            fallbackTop,
            VIEWPORT_PADDING,
            window.innerHeight - estimatedHeight - VIEWPORT_PADDING
          )

    return { left, top }
  }, [anchorRect, clientRect, items.length])

  return (
    <div
      role="menu"
      aria-label={t('chat.slashMenu.aria')}
      className="fixed z-[1200] w-max max-w-[min(92vw,560px)] overflow-hidden rounded-xl border border-black/10 bg-white shadow-[0_16px_48px_-24px_rgba(15,23,42,0.45)]"
      style={floatingStyle}
    >
      <div ref={menuListRef} className="max-h-60 overflow-y-auto overflow-x-hidden p-1.5">
        {items.length > 0 ? (
          items.map((item: CommandItem, index: number) => (
            <button
              ref={(node) => {
                itemRefs.current[index] = node
              }}
              key={item.title + index}
              type="button"
              role="menuitem"
              className={cn(
                'flex w-full min-w-[240px] items-center justify-between gap-4 rounded-lg px-2.5 py-2 text-left transition-colors',
                index === safeSelectedIndex ? 'bg-[#EBF4FF]' : 'hover:bg-secondary'
              )}
              onMouseEnter={() => setSelectedIndex(index)}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => command(item)}
            >
              <span
                className={cn(
                  'shrink-0 text-sm leading-5 font-medium',
                  index === safeSelectedIndex ? 'text-[#0A66FF]' : 'text-foreground'
                )}
              >
                {item.title}
              </span>
              {item.description ? (
                <span
                  className={cn(
                    'min-w-0 truncate text-right text-[11px] leading-4',
                    index === safeSelectedIndex ? 'text-[#5F6B7A]' : 'text-[#6B7280]'
                  )}
                  title={item.description}
                >
                  {item.description}
                </span>
              ) : null}
            </button>
          ))
        ) : (
          <p className="px-2.5 py-2 text-xs text-muted-foreground">{t('chat.slashMenu.noMatches')}</p>
        )}
      </div>
    </div>
  )
})

export default SlashMenu
