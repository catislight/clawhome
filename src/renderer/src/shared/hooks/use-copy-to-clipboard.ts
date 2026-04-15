import { useCallback, useEffect, useRef, useState } from 'react'

type UseCopyToClipboardOptions = {
  resetDelayMs?: number
}

type UseCopyToClipboardResult = {
  copied: boolean
  copyError: string | null
  copy: (value: string) => Promise<boolean>
}

function fallbackCopyText(value: string): boolean {
  if (typeof document === 'undefined') {
    return false
  }

  const activeElement =
    document.activeElement instanceof HTMLElement ? document.activeElement : null
  const textarea = document.createElement('textarea')
  textarea.value = value
  textarea.setAttribute('readonly', '')
  textarea.style.position = 'fixed'
  textarea.style.top = '0'
  textarea.style.left = '0'
  textarea.style.opacity = '0'
  textarea.style.pointerEvents = 'none'

  document.body.appendChild(textarea)
  textarea.focus()
  textarea.select()
  textarea.setSelectionRange(0, value.length)

  const copied = typeof document.execCommand === 'function' ? document.execCommand('copy') : false

  document.body.removeChild(textarea)
  activeElement?.focus()

  return copied
}

export function useCopyToClipboard({
  resetDelayMs = 1600
}: UseCopyToClipboardOptions = {}): UseCopyToClipboardResult {
  const [copied, setCopied] = useState(false)
  const [copyError, setCopyError] = useState<string | null>(null)
  const resetTimeoutRef = useRef<number | null>(null)

  const clearResetTimeout = useCallback(() => {
    if (resetTimeoutRef.current !== null) {
      window.clearTimeout(resetTimeoutRef.current)
      resetTimeoutRef.current = null
    }
  }, [])

  useEffect(() => {
    return () => {
      clearResetTimeout()
    }
  }, [clearResetTimeout])

  const copy = useCallback(
    async (value: string): Promise<boolean> => {
      if (!value.trim()) {
        setCopied(false)
        setCopyError(null)
        return false
      }

      const normalizedValue = value.replace(/\r\n/g, '\n')

      try {
        if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(normalizedValue)
        } else if (!fallbackCopyText(normalizedValue)) {
          throw new Error('当前环境不支持复制')
        }

        clearResetTimeout()
        setCopied(true)
        setCopyError(null)
        resetTimeoutRef.current = window.setTimeout(() => {
          setCopied(false)
          resetTimeoutRef.current = null
        }, resetDelayMs)
        return true
      } catch (error) {
        clearResetTimeout()
        setCopied(false)
        setCopyError(error instanceof Error ? error.message : '复制失败')
        return false
      }
    },
    [clearResetTimeout, resetDelayMs]
  )

  return {
    copied,
    copyError,
    copy
  }
}
