import type { InstanceGlobalConfigCategoryId } from '@/features/settings/lib/openclaw-instance-global-config-types'
import type { SettingsCenterController } from '@/features/settings/lib/use-settings-center-controller'
import { useAppI18n } from '@/shared/i18n/app-i18n'
import { DynamicFormRenderer } from '@/shared/lib/dynamic-form-engine'

type OpenClawInstanceGlobalDynamicFormPanelProps = {
  controller: SettingsCenterController
  activeCategoryId: InstanceGlobalConfigCategoryId
}

function OpenClawInstanceGlobalDynamicFormPanel({
  controller,
  activeCategoryId
}: OpenClawInstanceGlobalDynamicFormPanelProps): React.JSX.Element {
  const { t } = useAppI18n()
  return (
    <div className="space-y-3">
      {controller.formEngine.formErrors.length > 0 ? (
        <p className="whitespace-pre-line rounded-[0.6rem] border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {controller.formEngine.formErrors.join('\n')}
        </p>
      ) : null}

      {activeCategoryId === 'model' && controller.modelChoicesError ? (
        <p className="rounded-[0.6rem] border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
          {t('settings.error.modelChoicesLoadPrefix', {
            message: controller.modelChoicesError
          })}
        </p>
      ) : null}

      <DynamicFormRenderer
        engine={controller.formEngine}
        componentMap={controller.formComponentMap}
        visibleGroupIds={controller.visibleGroupIds}
        className="space-y-4"
        rowClassName="flex-wrap xl:flex-nowrap"
      />
    </div>
  )
}

export default OpenClawInstanceGlobalDynamicFormPanel
