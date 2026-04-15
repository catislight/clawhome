import { type ReactNode } from 'react'

import { resolveWorkspaceInstance } from '@/features/instances/lib/use-workspace-instance-selection'
import { cn } from '@/shared/lib/utils'
import { useAppStore } from '@/features/instances/store/use-app-store'

type AppShellContentAreaProps = {
  header?: ReactNode
  headerClassName?: string
  showHeaderWithoutConnectedInstance?: boolean
  children: ReactNode
  contentScrollable?: boolean
  disableInnerPadding?: boolean
  contentClassName?: string
  innerClassName?: string
}

function AppShellContentArea({
  header,
  headerClassName,
  showHeaderWithoutConnectedInstance = false,
  children,
  contentScrollable = true,
  disableInnerPadding = false,
  contentClassName,
  innerClassName
}: AppShellContentAreaProps): React.JSX.Element {
  const instances = useAppStore((state) => state.instances)
  const workspaceInstanceId = useAppStore((state) => state.workspaceInstanceId)
  const selectedInstance = resolveWorkspaceInstance(instances, workspaceInstanceId)
  const shouldRenderHeader =
    Boolean(header) &&
    (showHeaderWithoutConnectedInstance || selectedInstance?.connectionState === 'connected')

  return (
    <section className="flex min-w-0 flex-1 flex-col overflow-hidden bg-card">
      {shouldRenderHeader ? (
        <header
          className={cn(
            'shrink-0 flex h-[52px] items-center border-b border-black/6 px-3',
            headerClassName
          )}
        >
          {header}
        </header>
      ) : null}
      <div
        className={cn(
          'min-h-0 flex-1',
          contentScrollable ? 'overflow-y-auto' : 'overflow-hidden',
          contentClassName
        )}
      >
        <div
          className={cn(
            'flex min-h-full flex-col gap-4',
            disableInnerPadding ? 'p-0' : 'px-6 py-5',
            !contentScrollable && 'h-full min-h-0',
            innerClassName
          )}
        >
          {children}
        </div>
      </div>
    </section>
  )
}

export default AppShellContentArea
