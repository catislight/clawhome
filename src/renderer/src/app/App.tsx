import {
  Bookmark,
  Clock3,
  FileText,
  Home,
  LayoutGrid,
  Settings,
  SquareTerminal,
  Workflow
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { BrowserRouter, Link } from 'react-router-dom'

import openclawLogo from '../../../../resources/logo.png'
import AppShellLeftNavbar, {
  type AppShellNavigationItem,
  type AppShellNavigationSection
} from '@/shared/layout/app-shell-left-navbar'
import AppShellWorkspaceFooter from '@/shared/layout/app-shell-workspace-footer'
import { useOpenClawConnectionPolling } from '@/features/instances/lib/use-openclaw-connection-polling'
import AppRouter from '@/app/routes/app-router'
import { useAppI18n } from '@/shared/i18n/app-i18n'

type AppRouteId =
  | 'home'
  | 'knowledgeBase'
  | 'cron'
  | 'logs'
  | 'terminal'
  | 'skills'
  | 'agents'
  | 'settingsCenter'

function App(): React.JSX.Element {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const { language, t } = useAppI18n()

  const workspaceNavigationItems = useMemo<AppShellNavigationItem<AppRouteId>[]>(
    () => [
      {
        id: 'home',
        path: '/',
        title: t('nav.home'),
        icon: Home,
        children: []
      },
      {
        id: 'cron',
        path: '/cron',
        title: t('nav.cron'),
        icon: Clock3,
        children: []
      },
      {
        id: 'skills',
        path: '/skills',
        title: t('nav.skills'),
        icon: LayoutGrid,
        children: []
      },
      {
        id: 'agents',
        path: '/agents',
        title: t('nav.agents'),
        icon: Workflow,
        children: []
      },
      {
        id: 'knowledgeBase',
        path: '/knowledge-base',
        title: t('nav.knowledgeBase'),
        icon: Bookmark,
        children: []
      }
    ],
    [t]
  )

  const systemNavigationItems = useMemo<AppShellNavigationItem<AppRouteId>[]>(
    () => [
      {
        id: 'terminal',
        path: '/terminal',
        title: t('nav.terminal'),
        icon: SquareTerminal,
        children: []
      },
      {
        id: 'settingsCenter',
        path: '/settings-center',
        title: t('nav.settingsCenter'),
        icon: Settings,
        children: []
      },
      {
        id: 'logs',
        path: '/logs',
        title: t('nav.logs'),
        icon: FileText,
        children: []
      }
    ],
    [t]
  )

  const navigationSections = useMemo<AppShellNavigationSection<AppRouteId>[]>(
    () => [
      {
        id: 'workspace',
        title: t('nav.section.workspace'),
        items: workspaceNavigationItems
      },
      {
        id: 'system',
        title: t('nav.section.system'),
        items: systemNavigationItems
      }
    ],
    [systemNavigationItems, t, workspaceNavigationItems]
  )

  useOpenClawConnectionPolling()

  useEffect(() => {
    document.documentElement.lang = language
  }, [language])

  return (
    <BrowserRouter>
      <main className="flex h-screen w-screen overflow-hidden bg-background text-foreground">
        <div className="flex size-full overflow-hidden">
          <AppShellLeftNavbar
            sidebarHeader={
              sidebarCollapsed ? (
                <img src={openclawLogo} alt="ClawHome" className="size-8 object-contain" />
              ) : (
                <div className="flex min-w-0 flex-1 items-center justify-between gap-3.5">
                  <div className="flex min-w-0 items-center gap-3">
                    <img
                      src={openclawLogo}
                      alt="ClawHome"
                      className="size-8 shrink-0 object-contain"
                    />
                    <p className="brand-title-display truncate text-[1rem] leading-none">
                      {t('app.brandName')}
                    </p>
                  </div>
                  <Link
                    to="/preferences"
                    aria-label={t('app.openPreferences')}
                    className="window-no-drag flex size-9 shrink-0 items-center justify-center rounded-[0.85rem] text-muted-foreground transition-colors hover:bg-black/[0.04] hover:text-foreground"
                  >
                    <Settings className="size-[1.05rem]" />
                  </Link>
                </div>
              )
            }
            navigationSections={navigationSections}
            sidebarCollapsed={sidebarCollapsed}
            onSidebarCollapsedChange={setSidebarCollapsed}
            sidebarFooter={<AppShellWorkspaceFooter collapsed={sidebarCollapsed} />}
          />

          <AppRouter />
        </div>
      </main>
    </BrowserRouter>
  )
}

export default App
