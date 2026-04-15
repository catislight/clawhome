import { ChevronLeft, ChevronRight } from 'lucide-react'
import { type ComponentType, type CSSProperties, type ReactNode, type SVGProps } from 'react'
import { NavLink } from 'react-router-dom'

import { Button } from '@/shared/ui/button'
import { cn } from '@/shared/lib/utils'

export type AppShellIcon = ComponentType<SVGProps<SVGSVGElement>>

export type AppShellNavigationItem<T extends string = string> = {
  id: T
  path: string
  title: string
  icon: AppShellIcon
  children: AppShellNavigationItem<T>[]
}

export type AppShellNavigationSection<T extends string = string> = {
  id: string
  title: string
  items: AppShellNavigationItem<T>[]
}

type AppShellLeftNavbarProps<T extends string = string> = {
  sidebarHeader: ReactNode
  navigationSections: AppShellNavigationSection<T>[]
  sidebarCollapsed: boolean
  onSidebarCollapsedChange: (collapsed: boolean) => void
  sidebarFooter?: ReactNode
}

function AppShellLeftNavbar<T extends string>({
  sidebarHeader,
  navigationSections,
  sidebarCollapsed,
  onSidebarCollapsedChange,
  sidebarFooter
}: AppShellLeftNavbarProps<T>): React.JSX.Element {
  const sidebarVars = {
    '--sidebar-expanded-width': '14rem',
    '--sidebar-padding': '0.75rem',
    '--sidebar-toggle-size': '2.5rem',
    '--sidebar-gap': '0.75rem',
    '--sidebar-content-width': 'calc(var(--sidebar-expanded-width) - (var(--sidebar-padding) * 2))',
    '--sidebar-brand-width':
      'calc(var(--sidebar-content-width) - var(--sidebar-toggle-size) - var(--sidebar-gap))'
  } as CSSProperties

  return (
    <aside
      style={sidebarVars}
      className={cn(
        'relative z-10 flex h-full shrink-0 flex-col gap-4 overflow-visible border-r border-black/6 bg-[linear-gradient(180deg,#FBFCFE_0%,#F6F8FB_100%)] px-[var(--sidebar-padding)] pb-4 pt-0 transition-[width] duration-200 ease-in-out',
        sidebarCollapsed ? 'w-[4.875rem]' : 'w-56'
      )}
    >
      <div
        className={cn(
          'window-drag-region flex min-w-0 overflow-visible px-2 pt-5',
          sidebarCollapsed && 'justify-center'
        )}
      >
        <div
          className={cn(
            'flex h-16 min-w-0 flex-1 items-center overflow-visible rounded-[0.95rem]',
            sidebarCollapsed ? 'justify-center' : 'w-[var(--sidebar-brand-width)] justify-start'
          )}
        >
          {sidebarHeader}
        </div>
      </div>

      <Button
        size="icon"
        variant="outline"
        aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        className="absolute right-0 top-1/2 z-20 h-12 w-5 translate-x-1/2 -translate-y-1/2 rounded-full border border-black/10 bg-white text-muted-foreground opacity-100 shadow-[0_12px_24px_-18px_rgba(15,23,42,0.3)] transition-colors hover:border-primary/20 hover:bg-white hover:text-foreground [&_svg]:size-3.5"
        onClick={() => onSidebarCollapsedChange(!sidebarCollapsed)}
      >
        {sidebarCollapsed ? <ChevronRight /> : <ChevronLeft />}
      </Button>

      <nav className="flex flex-1 flex-col overflow-visible" aria-label="Sidebar navigation">
        {navigationSections.map((section, sectionIndex) => (
          <section
            key={section.id}
            className={cn(
              'space-y-[2px] overflow-visible',
              sectionIndex > 0 &&
                (sidebarCollapsed
                  ? 'mt-2 border-t border-black/6 pt-2'
                  : 'mt-3 border-t border-black/6 pt-3')
            )}
          >
            {!sidebarCollapsed ? (
              <p className="px-3 mb-2 text-[11px] font-semibold tracking-[0.08em] text-muted-foreground/80">
                {section.title}
              </p>
            ) : null}

            {section.items.map((item) => {
              const Icon = item.icon

              return (
                <div
                  key={item.id}
                  className={cn(
                    'overflow-visible',
                    sidebarCollapsed
                      ? 'flex w-auto justify-center'
                      : 'w-[var(--sidebar-content-width)]'
                  )}
                >
                  <NavLink
                    to={item.path}
                    end={item.path === '/'}
                    aria-label={item.title}
                    className={({ isActive }) =>
                      cn(
                        'inline-flex w-full shrink-0 items-center gap-3 whitespace-nowrap border text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70 focus-visible:ring-offset-2 focus-visible:ring-offset-background [&_svg]:pointer-events-none [&_svg:not([class*="size-"])]:size-4 [&_svg]:shrink-0',
                        sidebarCollapsed
                          ? 'size-10 justify-center rounded-[0.85rem] border-transparent'
                          : 'h-auto justify-start rounded-[0.85rem] px-3 py-[4px] text-left',
                        isActive
                          ? 'border-primary/18 bg-primary/8 text-foreground [&_svg]:text-primary'
                          : 'border-transparent text-muted-foreground hover:border-black/6 hover:bg-white hover:text-foreground'
                      )
                    }
                  >
                    <Icon data-icon={sidebarCollapsed ? undefined : 'inline-start'} />
                    {!sidebarCollapsed ? (
                      <span className="min-w-0 truncate font-medium">{item.title}</span>
                    ) : null}
                  </NavLink>
                </div>
              )
            })}
          </section>
        ))}
      </nav>

      {sidebarFooter ? (
        <div
          className={cn(
            'mt-auto overflow-visible',
            !sidebarCollapsed && 'w-[var(--sidebar-content-width)]'
          )}
        >
          {sidebarFooter}
        </div>
      ) : null}
    </aside>
  )
}

export default AppShellLeftNavbar
