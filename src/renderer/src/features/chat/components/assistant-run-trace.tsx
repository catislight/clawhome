import { Loader2 } from 'lucide-react'

import type { ConversationRunTrace } from '@/features/chat/lib/gateway-run-trace'
import { useAppI18n } from '@/shared/i18n/app-i18n'
import { cn } from '@/shared/lib/utils'

type AssistantRunTraceProps = {
  trace: ConversationRunTrace
  className?: string
  variant?: 'card' | 'embedded'
}

type TraceTagTone = 'skill' | 'tool'

function resolveTraceStatusLabel(
  trace: ConversationRunTrace,
  t: ReturnType<typeof useAppI18n>['t']
): string {
  const activeToolCall = trace.activeToolCalls.at(-1)

  if (activeToolCall) {
    if (activeToolCall.toolName.toLowerCase() === 'read' && activeToolCall.skillName) {
      return t('chat.trace.readingSkill', { skill: activeToolCall.skillName })
    }

    return t('chat.trace.callingTool', { tool: activeToolCall.toolName })
  }

  if (trace.isGenerating) {
    return t('chat.trace.generating')
  }

  return t('chat.trace.thisRun')
}

function TraceTag({
  label,
  tone,
  compact = false
}: {
  label: string
  tone: TraceTagTone
  compact?: boolean
}): React.JSX.Element {
  return (
    <span
      className={cn(
        compact
          ? 'inline-flex h-5 items-center rounded-full border px-2 text-[10px] font-medium tracking-[-0.01em]'
          : 'inline-flex h-6 items-center rounded-full border px-2.5 text-[11px] font-medium tracking-[-0.01em]',
        tone === 'skill'
          ? 'border-[#E7CFA0] bg-[#FFF5E2] text-[#8B5D14]'
          : 'border-black/8 bg-white text-[#526172]'
      )}
    >
      {label}
    </span>
  )
}

function TraceRow({
  label,
  tone,
  values,
  compact = false
}: {
  label: string
  tone: TraceTagTone
  values: string[]
  compact?: boolean
}): React.JSX.Element | null {
  if (values.length === 0) {
    return null
  }

  return (
    <div className={cn('flex flex-wrap items-center', compact ? 'gap-1.5' : 'gap-2')}>
      <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </span>

      {values.map((value) => (
        <TraceTag key={`${tone}-${value}`} label={value} tone={tone} compact={compact} />
      ))}
    </div>
  )
}

function AssistantRunTrace({
  trace,
  className,
  variant = 'card'
}: AssistantRunTraceProps): React.JSX.Element | null {
  const { t } = useAppI18n()
  const hasVisibleTrace = trace.skills.length > 0 || trace.tools.length > 0

  if (!hasVisibleTrace) {
    return null
  }

  if (variant === 'embedded') {
    return (
      <div className={cn('mb-2.5 border-b border-black/8 pb-2', className)}>
        <div className="flex items-center gap-2 text-[11px] text-[#5F6B7B]">
          {trace.activeToolCallIds.length > 0 || trace.isGenerating ? (
            <>
              <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
              <span>{resolveTraceStatusLabel(trace, t)}</span>
            </>
          ) : (
            <span>{t('chat.trace.thisRun')}</span>
          )}
        </div>

        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <TraceRow label="Skill" tone="skill" values={trace.skills} compact />
          <TraceRow label="Tool" tone="tool" values={trace.tools} compact />
        </div>
      </div>
    )
  }

  return (
    <div
      className={cn(
        'mb-1.5 rounded-[0.95rem] border border-black/7 bg-[#F6F8FB] px-3.5 py-3 shadow-[0_12px_24px_-22px_rgba(15,23,42,0.28)]',
        className
      )}
    >
      <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
        {trace.activeToolCallIds.length > 0 || trace.isGenerating ? (
          <>
            <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
            <span>{resolveTraceStatusLabel(trace, t)}</span>
          </>
        ) : (
          <span>{t('chat.trace.thisRun')}</span>
        )}
      </div>

      <div className="mt-2.5 space-y-2">
        <TraceRow label="Skill" tone="skill" values={trace.skills} />
        <TraceRow label="Tool" tone="tool" values={trace.tools} />
      </div>
    </div>
  )
}

export default AssistantRunTrace
