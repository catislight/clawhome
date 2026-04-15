import * as React from 'react'

import { cn } from '@/shared/lib/utils'

type InputDensity = 'default' | 'sm'

export type InputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  density?: InputDensity
}

const densityClassNames: Record<InputDensity, string> = {
  default: 'h-12 rounded-[0.8rem] px-4 text-sm',
  sm: 'h-9 rounded-[0.7rem] px-3 text-sm'
}

const baseClassName =
  'w-full border border-black/8 bg-background text-foreground outline-none transition-all hover:border-ring/40 focus:border-primary focus:ring-4 focus:ring-primary/10 disabled:cursor-not-allowed disabled:opacity-70'

const Input = React.forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, density = 'default', ...props },
  ref
) {
  return <input ref={ref} className={cn(baseClassName, densityClassNames[density], className)} {...props} />
})

export { Input }
