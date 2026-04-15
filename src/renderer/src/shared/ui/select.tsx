import { Check, ChevronDown } from 'lucide-react'
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent
} from 'react'

import { cn } from '@/shared/lib/utils'

export type SelectOption = {
  value: string
  label: string
  disabled?: boolean
}

type SelectProps = {
  value: string
  options: SelectOption[]
  onValueChange: (value: string) => void
  label?: string
  placeholder?: string
  ariaLabel?: string
  className?: string
  triggerClassName?: string
  contentClassName?: string
  disabled?: boolean
}

function findNextEnabledIndex(
  options: SelectOption[],
  startIndex: number,
  direction: 1 | -1
): number {
  if (options.length === 0) return -1

  let nextIndex = startIndex
  for (let i = 0; i < options.length; i += 1) {
    nextIndex = (nextIndex + direction + options.length) % options.length
    if (!options[nextIndex]?.disabled) {
      return nextIndex
    }
  }

  return -1
}

function Select({
  value,
  options,
  onValueChange,
  label,
  placeholder = '请选择',
  ariaLabel,
  className,
  triggerClassName,
  contentClassName,
  disabled = false
}: SelectProps): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([])
  const listboxId = useId()

  const selectedIndex = useMemo(
    () => options.findIndex((option) => option.value === value),
    [options, value]
  )
  const selectedOption = selectedIndex >= 0 ? options[selectedIndex] : null

  useEffect(() => {
    if (!open) {
      return
    }

    const handlePointerDown = (event: MouseEvent): void => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    const handleWindowBlur = (): void => {
      setOpen(false)
    }

    window.addEventListener('mousedown', handlePointerDown)
    window.addEventListener('blur', handleWindowBlur)

    return () => {
      window.removeEventListener('mousedown', handlePointerDown)
      window.removeEventListener('blur', handleWindowBlur)
    }
  }, [open])

  useEffect(() => {
    if (!open) {
      return
    }

    const nextIndex =
      selectedIndex >= 0 && !options[selectedIndex]?.disabled
        ? selectedIndex
        : findNextEnabledIndex(options, -1, 1)

    setHighlightedIndex(nextIndex)
  }, [open, options, selectedIndex])

  useEffect(() => {
    if (highlightedIndex < 0) {
      return
    }

    optionRefs.current[highlightedIndex]?.scrollIntoView({
      block: 'nearest'
    })
  }, [highlightedIndex])

  const selectIndex = (index: number): void => {
    const option = options[index]
    if (!option || option.disabled) {
      return
    }

    onValueChange(option.value)
    setOpen(false)
  }

  const handleTriggerKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>): void => {
    if (disabled) {
      return
    }

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      setOpen(true)
      return
    }

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      setOpen((current) => !current)
    }
  }

  const handleListKeyDown = (event: ReactKeyboardEvent<HTMLUListElement>): void => {
    if (event.key === 'Escape') {
      event.preventDefault()
      setOpen(false)
      return
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setHighlightedIndex((current) => findNextEnabledIndex(options, current, 1))
      return
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault()
      setHighlightedIndex((current) => findNextEnabledIndex(options, current, -1))
      return
    }

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      selectIndex(highlightedIndex)
    }
  }

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      <button
        aria-controls={open ? listboxId : undefined}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={ariaLabel}
        className={cn(
          'inline-flex w-full items-center justify-between gap-3 rounded-[0.8rem] border border-black/8 bg-white px-4 text-left text-sm text-foreground shadow-[0_8px_24px_-22px_rgba(15,23,42,0.28)] outline-none transition-colors hover:border-black/12 focus-visible:ring-2 focus-visible:ring-ring/70 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-70',
          'h-10',
          triggerClassName
        )}
        disabled={disabled}
        role="combobox"
        type="button"
        onClick={() => setOpen((current) => !current)}
        onKeyDown={handleTriggerKeyDown}
      >
        <span className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
          {label ? <span className="shrink-0 text-xs text-muted-foreground">{label}</span> : null}
          <span
            className={cn(
              'min-w-0 truncate font-medium',
              !selectedOption && 'text-muted-foreground'
            )}
            title={selectedOption?.label ?? placeholder}
          >
            {selectedOption?.label ?? placeholder}
          </span>
        </span>
        <ChevronDown
          className={cn('size-4 shrink-0 text-muted-foreground transition-transform', open && 'rotate-180')}
        />
      </button>

      {open ? (
        <div
          className={cn(
            'absolute right-0 top-[calc(100%+0.5rem)] z-50 min-w-full overflow-hidden rounded-[0.9rem] border border-black/10 bg-white shadow-[0_24px_60px_-24px_rgba(15,23,42,0.28)]',
            contentClassName
          )}
        >
          <ul
            id={listboxId}
            aria-label={ariaLabel}
            className="max-h-64 overflow-y-auto p-1.5"
            role="listbox"
            tabIndex={-1}
            onKeyDown={handleListKeyDown}
          >
            {options.map((option, index) => {
              const selected = option.value === value
              const highlighted = index === highlightedIndex

              return (
                <li key={option.value} role="presentation">
                  <button
                    ref={(element) => {
                      optionRefs.current[index] = element
                    }}
                    aria-selected={selected}
                    className={cn(
                      'flex w-full items-center justify-between gap-3 rounded-[0.7rem] px-3 py-1.5 text-left text-sm transition-colors',
                      selected ? 'bg-slate-100 text-foreground' : 'text-foreground',
                      highlighted && !selected ? 'bg-slate-50' : null,
                      option.disabled && 'cursor-not-allowed opacity-45'
                    )}
                    disabled={option.disabled}
                    role="option"
                    type="button"
                    onClick={() => selectIndex(index)}
                    onMouseEnter={() => setHighlightedIndex(index)}
                  >
                    <span className="min-w-0 truncate" title={option.label}>
                      {option.label}
                    </span>
                    <Check className={cn('size-4 shrink-0', selected ? 'opacity-100' : 'opacity-0')} />
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      ) : null}
    </div>
  )
}

export { Select }
