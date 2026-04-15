import * as React from 'react'

import { cn } from '@/shared/lib/utils'

export type SwitchProps = Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onChange'> & {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
}

const Switch = React.forwardRef<HTMLButtonElement, SwitchProps>(function Switch(
  { checked, className, disabled, onCheckedChange, ...props },
  ref
) {
  return (
    <button
      {...props}
      ref={ref}
      aria-checked={checked}
      className={cn(
        'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border border-transparent transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/70 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-60',
        checked ? 'bg-primary' : 'bg-slate-200',
        className
      )}
      disabled={disabled}
      role="switch"
      type="button"
      onClick={() => {
        if (disabled) {
          return
        }

        onCheckedChange(!checked)
      }}
    >
      <span
        className={cn(
          'pointer-events-none inline-block size-5 rounded-full bg-white shadow-[0_4px_10px_-6px_rgba(15,23,42,0.45)] transition-transform',
          checked ? 'translate-x-5' : 'translate-x-0.5'
        )}
      />
    </button>
  )
})

export { Switch }
