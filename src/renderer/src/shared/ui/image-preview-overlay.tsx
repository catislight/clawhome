import { X } from 'lucide-react'
import { useEffect } from 'react'
import { createPortal } from 'react-dom'

import { cn } from '@/shared/lib/utils'

type ImagePreviewOverlayProps = {
  src: string
  alt: string
  onClose: () => void
}

function ImagePreviewOverlay({ src, alt, onClose }: ImagePreviewOverlayProps): React.JSX.Element | null {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [onClose])

  if (typeof document === 'undefined') {
    return null
  }

  return createPortal(
    <div
      aria-modal="true"
      role="dialog"
      className="fixed inset-0 z-[120] h-dvh w-dvw bg-slate-950/82 backdrop-blur-[3px]"
      onClick={onClose}
    >
      <button
        type="button"
        aria-label="关闭图片预览"
        className={cn(
          'absolute right-4 top-4 inline-flex size-10 items-center justify-center rounded-full',
          'border border-white/30 bg-black/45 text-white shadow-[0_10px_26px_-16px_rgba(2,8,23,0.95)]',
          'transition-colors hover:bg-black/62'
        )}
        onClick={onClose}
      >
        <X className="size-4" />
      </button>

      <div
        className="flex h-full w-full items-center justify-center p-4 sm:p-8"
        onClick={(event) => event.stopPropagation()}
      >
        <div
          className={cn(
            'max-h-[calc(100dvh-2rem)] max-w-[calc(100dvw-2rem)] overflow-hidden',
            'rounded-2xl bg-white/96 shadow-[0_0_22px_-10px_rgba(96,145,255,0.34),0_0_10px_-4px_rgba(96,145,255,0.22)]',
            'sm:max-h-[calc(100dvh-4rem)] sm:max-w-[calc(100dvw-4rem)]'
          )}
        >
          <img src={src} alt={alt} className="block max-h-[calc(100dvh-2rem)] max-w-[calc(100dvw-2rem)] object-contain sm:max-h-[calc(100dvh-4rem)] sm:max-w-[calc(100dvw-4rem)]" />
        </div>
      </div>
    </div>,
    document.body
  )
}

export default ImagePreviewOverlay
