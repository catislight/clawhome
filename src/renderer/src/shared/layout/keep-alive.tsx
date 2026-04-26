import { type ReactNode, useRef } from 'react'

import { cn } from '@/shared/lib/utils'

type KeepAliveProps = {
  cacheKey: string
  active: boolean
  children: ReactNode
  maxEntries?: number
  className?: string
}

function KeepAlive({
  cacheKey,
  active,
  children,
  maxEntries = 3,
  className
}: KeepAliveProps): React.JSX.Element | null {
  const cacheRef = useRef(new Map<string, ReactNode>())
  const accessOrderRef = useRef<string[]>([])

  const normalizedCacheKey = cacheKey.trim()
  const resolvedMaxEntries = Number.isFinite(maxEntries)
    ? Math.max(1, Math.floor(maxEntries))
    : 3

  if (active && normalizedCacheKey.length > 0) {
    cacheRef.current.set(normalizedCacheKey, children)

    accessOrderRef.current = [
      ...accessOrderRef.current.filter((key) => key !== normalizedCacheKey),
      normalizedCacheKey
    ]

    while (accessOrderRef.current.length > resolvedMaxEntries) {
      const evictedKey = accessOrderRef.current.shift()
      if (!evictedKey) {
        break
      }
      cacheRef.current.delete(evictedKey)
    }
  }

  const cachedNode = normalizedCacheKey ? cacheRef.current.get(normalizedCacheKey) : null

  const visibilityClassName = active ? 'flex min-h-0 flex-1' : 'hidden'

  if (!cachedNode) {
    return null
  }

  return (
    <div aria-hidden={!active} className={cn(visibilityClassName, className)}>
      {cachedNode}
    </div>
  )
}

export default KeepAlive
