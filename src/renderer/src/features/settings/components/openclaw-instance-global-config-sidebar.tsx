import type {
  InstanceGlobalConfigCategory,
  InstanceGlobalConfigCategoryId
} from '@/features/settings/lib/openclaw-instance-global-config-types'
import { useAppI18n } from '@/shared/i18n/app-i18n'
import { cn } from '@/shared/lib/utils'
import { Button } from '@/shared/ui/button'

type OpenClawInstanceGlobalConfigSidebarProps = {
  categories: InstanceGlobalConfigCategory[]
  activeCategoryId: InstanceGlobalConfigCategoryId
  onCategoryChange: (categoryId: InstanceGlobalConfigCategoryId) => void
  onOpenJsonConfig: () => void
  jsonConfigDisabled?: boolean
}

function OpenClawInstanceGlobalConfigSidebar({
  categories,
  activeCategoryId,
  onCategoryChange,
  onOpenJsonConfig,
  jsonConfigDisabled = false
}: OpenClawInstanceGlobalConfigSidebarProps): React.JSX.Element {
  const { t } = useAppI18n()
  return (
    <aside className="flex h-full min-h-0 w-[280px] flex-col border-r border-black/6 bg-[#FBFCFF]">
      <header className="flex h-[52px] shrink-0 items-center justify-between border-b border-black/6 px-3">
        <h2 className="text-sm font-semibold tracking-tight text-foreground">{t('settings.sidebar.title')}</h2>
        <Button
          type="button"
          variant="ghost"
          className="h-7 rounded-[0.65rem] px-2 text-xs text-blue-600 hover:bg-blue-50 hover:text-blue-700 disabled:text-blue-300"
          disabled={jsonConfigDisabled}
          onClick={onOpenJsonConfig}
        >
          {t('settings.sidebar.jsonConfig')}
        </Button>
      </header>

      <div className="min-h-0 flex-1 space-y-1 overflow-y-auto px-3 pt-2 pb-3">
        {categories.map((category) => (
          <button
            key={category.id}
            type="button"
            aria-pressed={activeCategoryId === category.id}
            className={cn(
              'w-full rounded-[0.65rem] px-2.5 py-2 text-left transition-colors',
              activeCategoryId === category.id
                ? 'bg-primary/10 text-foreground'
                : 'text-muted-foreground hover:bg-black/4 hover:text-foreground'
            )}
            onClick={() => {
              onCategoryChange(category.id)
            }}
          >
            <p className="text-sm font-medium">{category.label}</p>
            <p className="text-[11px] leading-5">{category.description}</p>
          </button>
        ))}
      </div>
    </aside>
  )
}

export default OpenClawInstanceGlobalConfigSidebar
