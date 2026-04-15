import { type ReactNode } from 'react'

import { cn } from '@/shared/lib/utils'

type AppShellSplitWorkspaceProps = {
  sidebar: ReactNode
  children: ReactNode
  sidebarClassName?: string
  contentHeader?: ReactNode
  contentHeaderClassName?: string
  contentBodyClassName?: string
  contentFooter?: ReactNode
  contentFooterClassName?: string
}

function AppShellSplitWorkspace({
  sidebar,
  children,
  sidebarClassName,
  contentHeader,
  contentHeaderClassName,
  contentBodyClassName,
  contentFooter,
  contentFooterClassName
}: AppShellSplitWorkspaceProps): React.JSX.Element {
  return (
    <section className="flex h-full min-h-0">
      <div className={cn('h-full min-h-0 shrink-0', sidebarClassName)}>{sidebar}</div>

      <section className="flex min-h-0 flex-1 flex-col">
        {contentHeader ? (
          <header
            className={cn(
              'flex h-[52px] shrink-0 items-center border-b border-black/6 px-4',
              contentHeaderClassName
            )}
          >
            {contentHeader}
          </header>
        ) : null}

        <div className={cn('min-h-0 flex-1', contentBodyClassName)}>{children}</div>

        {contentFooter ? (
          <footer
            className={cn('h-[56px] shrink-0 border-t border-black/6 px-4', contentFooterClassName)}
          >
            {contentFooter}
          </footer>
        ) : null}
      </section>
    </section>
  )
}

export default AppShellSplitWorkspace
