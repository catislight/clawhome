import { X } from 'lucide-react'
import { type CSSProperties, type ReactNode } from 'react'

import { Button } from '@/shared/ui/button'
import { cn } from '@/shared/lib/utils'

type DialogShellProps = {
  title: string
  onClose: () => void
  children: ReactNode
  maxWidthClassName?: string
  dialogStyle?: CSSProperties
}

function DialogShell({
  title,
  onClose,
  children,
  maxWidthClassName,
  dialogStyle
}: DialogShellProps): React.JSX.Element {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-[6px] sm:p-5">
      <div
        aria-modal="true"
        className={cn(
          'max-h-[calc(100vh-2rem)] w-full overflow-hidden rounded-[1.05rem] border border-black/8 bg-card shadow-[0_34px_90px_-28px_rgba(15,23,42,0.36)] sm:max-h-[calc(100vh-3rem)]',
          maxWidthClassName ?? 'max-w-[calc(100vw-1rem)] lg:max-w-[min(50vw,36rem)]'
        )}
        role="dialog"
        style={dialogStyle}
      >
        <div className="flex items-start justify-between gap-4 border-b border-black/6 px-4 py-3.5 sm:px-5 sm:py-4">
          <div className="min-h-8 flex items-center">
            <h2 className="text-[1.05rem] font-semibold tracking-tight text-foreground sm:text-[1.1rem]">
              {title}
            </h2>
          </div>

          <Button
            aria-label="关闭弹窗"
            className="size-8 rounded-[0.7rem] border border-transparent text-muted-foreground hover:border-black/6 hover:bg-secondary hover:text-foreground"
            size="icon"
            type="button"
            variant="ghost"
            onClick={onClose}
          >
            <X className="size-4" />
          </Button>
        </div>

        <div className="max-h-[calc(100vh-8rem)] overflow-y-auto px-4 py-4 sm:px-5 sm:py-4">
          {children}
        </div>
      </div>
    </div>
  )
}

export default DialogShell
