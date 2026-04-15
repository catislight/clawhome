import { useEffect, useMemo, useState } from 'react'

type UseTypewriterTextOptions = {
  text: string
  enabled?: boolean
  stepDelayMs?: number
}

const DEFAULT_STEP_DELAY_MS = 18

const graphemeSegmenter =
  typeof Intl !== 'undefined' && 'Segmenter' in Intl
    ? new Intl.Segmenter('zh-CN', { granularity: 'grapheme' })
    : null

export function splitGraphemes(value: string): string[] {
  if (!value) {
    return []
  }

  if (!graphemeSegmenter) {
    return Array.from(value)
  }

  return Array.from(graphemeSegmenter.segment(value), (segment) => segment.segment)
}

function resolveStepConfig(
  remaining: number,
  stepDelayMs: number
): { step: number; delay: number } {
  const minDelayMs = 4
  const normalizedBuffer = Math.min(Math.max(remaining - 1, 0), 1_600)
  const pressure = normalizedBuffer / 1_600
  const easedPressure = Math.sqrt(pressure)
  const delay = Math.round(stepDelayMs - easedPressure * (stepDelayMs - minDelayMs))
  const step =
    remaining > 1_200
      ? 20
      : remaining > 720
        ? 12
        : remaining > 320
          ? 8
          : remaining > 160
            ? 4
            : remaining > 64
              ? 2
              : 1

  return {
    step,
    delay: Math.max(minDelayMs, delay)
  }
}

export function useTypewriterText({
  text,
  enabled = true,
  stepDelayMs = DEFAULT_STEP_DELAY_MS
}: UseTypewriterTextOptions): { displayedText: string; isAnimating: boolean } {
  const targetSegments = useMemo(() => splitGraphemes(text), [text])
  const targetLength = targetSegments.length
  const [displayedCount, setDisplayedCount] = useState(targetLength)
  const animatedText = useMemo(
    () => targetSegments.slice(0, Math.min(displayedCount, targetLength)).join(''),
    [displayedCount, targetLength, targetSegments]
  )
  const canAnimate = enabled && text.startsWith(animatedText) && displayedCount <= targetLength
  const displayedText = canAnimate ? animatedText : text
  const isAnimating = enabled && canAnimate && displayedCount < targetLength

  useEffect(() => {
    if (!enabled) {
      if (displayedCount === targetLength) {
        return
      }

      const timeoutId = window.setTimeout(() => {
        setDisplayedCount(targetLength)
      }, 0)

      return () => {
        window.clearTimeout(timeoutId)
      }
    }

    if (!canAnimate) {
      if (displayedCount === targetLength) {
        return
      }

      const timeoutId = window.setTimeout(() => {
        setDisplayedCount(targetLength)
      }, 0)

      return () => {
        window.clearTimeout(timeoutId)
      }
    }

    if (displayedCount >= targetLength) {
      return
    }

    const remaining = targetLength - displayedCount

    if (remaining <= 0) {
      return
    }

    const stepConfig = resolveStepConfig(remaining, stepDelayMs)

    const timeoutId = window.setTimeout(() => {
      setDisplayedCount((current) => Math.min(targetLength, current + stepConfig.step))
    }, stepConfig.delay)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [canAnimate, displayedCount, enabled, stepDelayMs, targetLength])

  return {
    displayedText,
    isAnimating
  }
}
