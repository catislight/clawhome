import { MoreHorizontal } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

import { cn } from '@/shared/lib/utils'

import { Button } from './button'

export type OverflowMenuItem = {
  key: string
  label: string
  onSelect: () => void
  disabled?: boolean
  hidden?: boolean
}

type OverflowMenuSide = 'top' | 'bottom' | 'left' | 'right'
type OverflowMenuAlign = 'start' | 'end'

type OverflowMenuProps = {
  items: OverflowMenuItem[]
  triggerLabel?: string
  align?: OverflowMenuAlign
  side?: OverflowMenuSide
  renderInPortal?: boolean
  onOpenChange?: (open: boolean) => void
  className?: string
  contentClassName?: string
  triggerClassName?: string
}

function OverflowMenu({
  items,
  triggerLabel = '更多操作',
  align = 'end',
  side = 'bottom',
  renderInPortal = false,
  onOpenChange,
  className,
  contentClassName,
  triggerClassName
}: OverflowMenuProps): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const [resolvedSide, setResolvedSide] = useState<OverflowMenuSide>(side)
  const [portalPosition, setPortalPosition] = useState<{ top: number; left: number } | null>(null)

  const rootRef = useRef<HTMLDivElement | null>(null)
  const menuRef = useRef<HTMLDivElement | null>(null)

  const visibleItems = useMemo(() => items.filter((item) => item.hidden !== true), [items])

  const resolvePortalMenuPosition = useCallback((): void => {
    if (renderInPortal === false) {
      return
    }

    const rootElement = rootRef.current
    const menuElement = menuRef.current
    if (!rootElement || !menuElement) {
      return
    }

    const triggerRect = rootElement.getBoundingClientRect()
    const menuRect = menuElement.getBoundingClientRect()
    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight
    const gap = 6
    const viewportPadding = 8

    const availableBottom = viewportHeight - triggerRect.bottom - gap
    const availableTop = triggerRect.top - gap
    const availableRight = viewportWidth - triggerRect.right - gap
    const availableLeft = triggerRect.left - gap

    let nextSide = side
    if (side === 'bottom' && availableBottom < menuRect.height && availableTop > availableBottom) {
      nextSide = 'top'
    } else if (side === 'top' && availableTop < menuRect.height && availableBottom > availableTop) {
      nextSide = 'bottom'
    } else if (
      side === 'right' &&
      availableRight < menuRect.width &&
      availableLeft > availableRight
    ) {
      nextSide = 'left'
    } else if (
      side === 'left' &&
      availableLeft < menuRect.width &&
      availableRight > availableLeft
    ) {
      nextSide = 'right'
    }

    let top = 0
    let left = 0

    if (nextSide === 'bottom') {
      top = triggerRect.bottom + gap
      left = align === 'start' ? triggerRect.left : triggerRect.right - menuRect.width
    } else if (nextSide === 'top') {
      top = triggerRect.top - menuRect.height - gap
      left = align === 'start' ? triggerRect.left : triggerRect.right - menuRect.width
    } else if (nextSide === 'right') {
      top = align === 'start' ? triggerRect.top : triggerRect.bottom - menuRect.height
      left = triggerRect.right + gap
    } else {
      top = align === 'start' ? triggerRect.top : triggerRect.bottom - menuRect.height
      left = triggerRect.left - menuRect.width - gap
    }

    const clampedTop = Math.min(
      Math.max(top, viewportPadding),
      Math.max(viewportPadding, viewportHeight - menuRect.height - viewportPadding)
    )
    const clampedLeft = Math.min(
      Math.max(left, viewportPadding),
      Math.max(viewportPadding, viewportWidth - menuRect.width - viewportPadding)
    )

    setResolvedSide(nextSide)
    setPortalPosition({
      top: Math.round(clampedTop),
      left: Math.round(clampedLeft)
    })
  }, [align, renderInPortal, side])

  useEffect(() => {
    onOpenChange?.(open)
  }, [onOpenChange, open])

  useEffect(() => {
    if (open === false) {
      return
    }

    const handlePointerDown = (event: MouseEvent): void => {
      const eventTarget = event.target as Node
      const clickedInsideRoot = rootRef.current?.contains(eventTarget) === true
      const clickedInsideMenu = menuRef.current?.contains(eventTarget) === true

      if (clickedInsideRoot === false && clickedInsideMenu === false) {
        setOpen(false)
      }
    }

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        setOpen(false)
      }
    }

    const handleWindowBlur = (): void => {
      setOpen(false)
    }

    window.addEventListener('mousedown', handlePointerDown)
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('blur', handleWindowBlur)

    return () => {
      window.removeEventListener('mousedown', handlePointerDown)
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('blur', handleWindowBlur)
    }
  }, [open])

  useEffect(() => {
    if (open === false || renderInPortal === false) {
      return
    }

    const frameId = window.requestAnimationFrame(() => {
      resolvePortalMenuPosition()
    })

    return () => {
      window.cancelAnimationFrame(frameId)
    }
  }, [open, renderInPortal, resolvePortalMenuPosition])

  useEffect(() => {
    if (open === false || renderInPortal === false) {
      return
    }

    const handleReposition = (): void => {
      resolvePortalMenuPosition()
    }

    window.addEventListener('resize', handleReposition)
    window.addEventListener('scroll', handleReposition, true)

    return () => {
      window.removeEventListener('resize', handleReposition)
      window.removeEventListener('scroll', handleReposition, true)
    }
  }, [open, renderInPortal, resolvePortalMenuPosition])

  const menuSideForAnimation = renderInPortal ? resolvedSide : side

  const menuNode = open ? (
    <div
      ref={menuRef}
      aria-hidden={false}
      data-state="open"
      role="menu"
      onMouseDownCapture={(event) => {
        event.stopPropagation()
      }}
      onPointerDownCapture={(event) => {
        event.stopPropagation()
      }}
      onClick={(event) => {
        event.stopPropagation()
      }}
      className={cn(
        'z-20 flex min-w-[9rem] flex-col gap-0.5 rounded-[1rem] border border-black/8 bg-white p-1.5 shadow-[0_20px_40px_-24px_rgba(15,23,42,0.2)] transition-[opacity,transform] duration-150 ease-out',
        renderInPortal ? 'fixed z-[80]' : 'absolute',
        renderInPortal === false && side === 'bottom' && 'top-[calc(100%+0.375rem)]',
        renderInPortal === false && side === 'top' && 'bottom-[calc(100%+0.375rem)]',
        renderInPortal === false && side === 'right' && 'left-[calc(100%+0.375rem)]',
        renderInPortal === false && side === 'left' && 'right-[calc(100%+0.375rem)]',
        renderInPortal === false &&
          align === 'end' &&
          side === 'bottom' &&
          'right-0 origin-top-right',
        renderInPortal === false &&
          align === 'start' &&
          side === 'bottom' &&
          'left-0 origin-top-left',
        renderInPortal === false &&
          align === 'end' &&
          side === 'top' &&
          'right-0 origin-bottom-right',
        renderInPortal === false &&
          align === 'start' &&
          side === 'top' &&
          'left-0 origin-bottom-left',
        renderInPortal === false &&
          align === 'end' &&
          side === 'right' &&
          'bottom-0 origin-bottom-left',
        renderInPortal === false &&
          align === 'start' &&
          side === 'right' &&
          'top-0 origin-top-left',
        renderInPortal === false &&
          align === 'end' &&
          side === 'left' &&
          'bottom-0 origin-bottom-right',
        renderInPortal === false &&
          align === 'start' &&
          side === 'left' &&
          'top-0 origin-top-right',
        renderInPortal && menuSideForAnimation === 'bottom' && 'origin-top',
        renderInPortal && menuSideForAnimation === 'top' && 'origin-bottom',
        renderInPortal && menuSideForAnimation === 'right' && 'origin-left',
        renderInPortal && menuSideForAnimation === 'left' && 'origin-right',
        'translate-y-0 scale-100 opacity-100',
        contentClassName
      )}
      style={
        renderInPortal
          ? {
              top: portalPosition?.top ?? -9999,
              left: portalPosition?.left ?? -9999
            }
          : undefined
      }
    >
      {visibleItems.map((item) => (
        <button
          key={item.key}
          type="button"
          role="menuitem"
          disabled={item.disabled}
          className="flex h-9 w-full items-center justify-start whitespace-nowrap rounded-[0.8rem] px-3.5 text-[13px] font-medium text-foreground/88 transition-colors hover:bg-secondary hover:text-foreground disabled:cursor-not-allowed disabled:opacity-45"
          onMouseDownCapture={(event) => {
            event.stopPropagation()
          }}
          onPointerDownCapture={(event) => {
            event.stopPropagation()
          }}
          onClick={(event) => {
            event.stopPropagation()

            if (item.disabled) {
              return
            }

            setOpen(false)
            item.onSelect()
          }}
        >
          {item.label}
        </button>
      ))}
    </div>
  ) : null

  return (
    <div ref={rootRef} className={cn('relative shrink-0', className)}>
      <Button
        type="button"
        size="icon"
        variant="ghost"
        aria-label={triggerLabel}
        aria-expanded={open}
        aria-haspopup="menu"
        className={cn(
          'size-8 rounded-[0.7rem] text-muted-foreground hover:bg-secondary hover:text-foreground',
          triggerClassName
        )}
        onClick={(event) => {
          event.stopPropagation()
          setOpen((current) => current === false)
        }}
      >
        <MoreHorizontal className="size-4" />
      </Button>

      {menuNode && renderInPortal && typeof document !== 'undefined'
        ? createPortal(menuNode, document.body)
        : menuNode}
    </div>
  )
}

export { OverflowMenu }
