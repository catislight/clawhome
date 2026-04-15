import type { SshConnectionFormValues } from '@/features/instances/model/ssh-connection'
import { useResolvedAgentAvatarSource } from '@/features/agents/lib/openclaw-agent-avatar-image'
import { cn } from '@/shared/lib/utils'

type OpenClawAgentAvatarProps = {
  label: string
  emoji?: string
  avatar?: string
  workspacePath?: string
  connectionConfig?: SshConnectionFormValues | null
  className?: string
  imageClassName?: string
}

function OpenClawAgentAvatar({
  label,
  emoji,
  avatar,
  workspacePath,
  connectionConfig,
  className,
  imageClassName
}: OpenClawAgentAvatarProps): React.JSX.Element {
  const resolvedImageSrc = useResolvedAgentAvatarSource({
    avatar,
    workspacePath,
    connectionConfig: connectionConfig ?? null
  })
  const fallbackEmoji = emoji?.trim() || '🤖'

  return (
    <span
      className={cn(
        'inline-flex items-center justify-center overflow-hidden rounded-full border border-black/10 bg-white text-sm leading-none',
        className
      )}
      title={label}
      aria-label={label}
    >
      {resolvedImageSrc ? (
        <img
          src={resolvedImageSrc}
          alt={label}
          className={cn('size-full object-cover', imageClassName)}
          draggable={false}
        />
      ) : (
        <span>{fallbackEmoji}</span>
      )}
    </span>
  )
}

export default OpenClawAgentAvatar
