import * as React from 'react'

import { cn } from '@/shared/lib/utils'

type TextareaDensity = 'default' | 'sm'

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  density?: TextareaDensity
}

const densityClassNames: Record<TextareaDensity, string> = {
  default: 'min-h-36 rounded-[0.8rem] text-sm',
  sm: 'min-h-28 rounded-[0.7rem] text-sm'
}

const densityPaddingClassNames: Record<TextareaDensity, string> = {
  default: 'px-4 py-3',
  sm: 'px-3 py-2.5'
}

const wrapperBaseClassName =
  'relative w-full overflow-hidden border border-black/8 bg-background text-foreground transition-all hover:border-ring/40 focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/10 [background-clip:padding-box]'

const fieldBaseClassName =
  'block w-full min-h-full resize-none overflow-x-hidden overflow-y-auto bg-transparent text-inherit outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed'

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { className, density = 'default', disabled, ...props },
  ref
) {
  return (
    <div
      className={cn(
        wrapperBaseClassName,
        densityClassNames[density],
        disabled ? 'cursor-not-allowed opacity-70' : null,
        className
      )}
    >
      <textarea
        ref={ref}
        disabled={disabled}
        className={cn(fieldBaseClassName, densityPaddingClassNames[density])}
        {...props}
      />
    </div>
  )
})

export { Textarea }
