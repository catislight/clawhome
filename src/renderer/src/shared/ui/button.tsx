import * as React from 'react'

import { cn } from '@/shared/lib/utils'

type ButtonVariant = 'default' | 'outline' | 'secondary' | 'ghost'
type ButtonSize = 'default' | 'sm' | 'lg' | 'icon'

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant
  size?: ButtonSize
}

const baseClassName =
  'inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*="size-"])]:size-4 [&_svg]:shrink-0'

const variantClassNames: Record<ButtonVariant, string> = {
  default: 'bg-primary text-primary-foreground shadow-sm hover:bg-primary/90',
  outline: 'border border-input bg-background text-foreground shadow-sm hover:bg-secondary',
  secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
  ghost: 'hover:bg-secondary hover:text-foreground'
}

const sizeClassNames: Record<ButtonSize, string> = {
  default: 'h-9 rounded-md px-4 py-2 text-sm',
  sm: 'h-8 rounded-md px-3 text-xs',
  lg: 'h-10 rounded-md px-6 text-sm',
  icon: 'size-9 rounded-md'
}

function Button({
  className,
  variant = 'default',
  size = 'default',
  ...props
}: ButtonProps): React.JSX.Element {
  return (
    <button
      className={cn(baseClassName, variantClassNames[variant], sizeClassNames[size], className)}
      data-slot="button"
      {...props}
    />
  )
}

export { Button }
