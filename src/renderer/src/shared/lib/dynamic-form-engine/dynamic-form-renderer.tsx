import { Fragment } from 'react'
import { Controller, type FieldValues, type Path } from 'react-hook-form'

import { getValueAtPath } from './path-utils'
import type {
  DynamicFormComponentMap,
  DynamicFormEngineResult,
  DynamicFormField,
  DynamicFormFieldActionConfig
} from './types'
import { cn } from '@/shared/lib/utils'

type DynamicFormRendererProps<TValues extends FieldValues = FieldValues> = {
  engine: DynamicFormEngineResult<TValues>
  componentMap: DynamicFormComponentMap<TValues>
  visibleGroupIds?: string[]
  className?: string
  groupClassName?: string
  rowClassName?: string
  columnClassName?: string
  labelClassName?: string
  descriptionClassName?: string
  errorClassName?: string
}

function shouldRenderField<TValues extends FieldValues>(
  field: DynamicFormField<TValues>,
  values: TValues
): boolean {
  if (!field.visibleWhen) {
    return true
  }

  return field.visibleWhen({
    values,
    getValue: (path) => getValueAtPath(values, path)
  })
}

function isFieldDisabled<TValues extends FieldValues>(
  field: DynamicFormField<TValues>,
  values: TValues
): boolean {
  if (!field.disabledWhen) {
    return false
  }

  return field.disabledWhen({
    values,
    getValue: (path) => getValueAtPath(values, path)
  })
}

function toActionConfig<TValues extends FieldValues>(
  action: DynamicFormField<TValues>['action']
): DynamicFormFieldActionConfig<TValues> | null {
  if (!action || typeof action !== 'object' || Array.isArray(action)) {
    return null
  }

  if ('fieldId' in action || 'render' in action) {
    return action as DynamicFormFieldActionConfig<TValues>
  }

  return null
}

function DynamicFormRenderer<TValues extends FieldValues = FieldValues>({
  engine,
  componentMap,
  visibleGroupIds,
  className,
  groupClassName,
  rowClassName,
  columnClassName,
  labelClassName,
  descriptionClassName,
  errorClassName
}: DynamicFormRendererProps<TValues>): React.JSX.Element {
  const values = engine.form.watch()
  const visibleGroupSet = visibleGroupIds ? new Set(visibleGroupIds) : null
  const fieldMap = new Map(
    engine.fields.map((field) => [String(field.id).trim(), field] as const)
  )

  return (
    <div className={cn('space-y-6', className)}>
      {engine.layout.map((group) => {
        if (visibleGroupSet && !visibleGroupSet.has(group.id)) {
          return null
        }

        const visibleRows = group.rows
          .map((row) => row.fields.filter((field) => shouldRenderField(field, values as TValues)))
          .filter((fields) => fields.length > 0)

        if (visibleRows.length === 0) {
          return null
        }

        return (
          <section key={group.id} className={cn('space-y-3', groupClassName)}>
            <h3 className="text-sm font-semibold text-foreground">{group.id}</h3>

            <div className="space-y-3">
              {visibleRows.map((row, rowIndex) => (
                <div key={`${group.id}-${rowIndex}`} className={cn('flex gap-3', rowClassName)}>
                  {row.map((field) => {
                    const fieldComponent = componentMap[field.render]
                    const actionConfig = toActionConfig(field.action)
                    const actionFieldId = String(actionConfig?.fieldId ?? '').trim()
                    const actionField = actionFieldId ? fieldMap.get(actionFieldId) : null
                    const actionComponent = actionField ? componentMap[actionField.render] : null
                    const actionRender = String(actionConfig?.render ?? '').trim()
                    const actionRenderComponent = actionRender ? componentMap[actionRender] : null
                    const actionSlot = actionConfig ? null : field.action

                    if (!fieldComponent) {
                      return (
                        <div
                          key={String(field.id)}
                          className={cn(
                            'flex-1 rounded-[0.7rem] border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700',
                            columnClassName
                          )}
                        >
                          无法渲染字段 {String(field.id)}：缺少 {field.render} 组件
                        </div>
                      )
                    }

                    const FieldComponent = fieldComponent
                    const fieldName = String(field.id) as Path<TValues>
                    const disabled = isFieldDisabled(field, values as TValues)
                    const shouldShowAction = Boolean(
                      actionField && shouldRenderField(actionField, values as TValues)
                    )
                    const actionDisabled =
                      actionField ? isFieldDisabled(actionField, values as TValues) : false

                    return (
                      <div
                        key={String(field.id)}
                        className={cn('min-w-0 flex-1 space-y-1.5', columnClassName)}
                      >
                        <div className="flex min-w-0 items-center justify-between gap-2">
                          <div className="min-w-0 space-y-0.5">
                            <label
                              htmlFor={fieldName}
                              className={cn(
                                'block min-w-0 text-xs font-medium text-muted-foreground',
                                labelClassName
                              )}
                            >
                              {field.metadata.label}
                            </label>
                            {field.metadata.desc ? (
                              <p
                                className={cn(
                                  'text-[11px] leading-5 text-muted-foreground',
                                  descriptionClassName
                                )}
                              >
                                {field.metadata.desc}
                              </p>
                            ) : null}
                          </div>

                          {shouldShowAction && actionField && actionComponent ? (
                            <div className="shrink-0">
                              <Controller
                                control={engine.form.control}
                                name={String(actionField.id) as Path<TValues>}
                                render={({ field: actionControllerField, fieldState }) => {
                                  const ActionComponent = actionComponent
                                  const currentValues = engine.form.getValues()
                                  const handleActionChange = (nextValue: unknown): void => {
                                    const normalizedValue = actionField.normalize
                                      ? actionField.normalize(nextValue, {
                                          values: currentValues,
                                          getValue: (path) => getValueAtPath(currentValues, path)
                                        })
                                      : nextValue

                                    actionControllerField.onChange(normalizedValue)
                                  }

                                  return (
                                    <ActionComponent
                                      field={actionField}
                                      metadata={actionField.metadata}
                                      name={String(actionField.id)}
                                      value={actionControllerField.value}
                                      onChange={handleActionChange}
                                      onBlur={actionControllerField.onBlur}
                                      disabled={actionDisabled}
                                      invalid={fieldState.invalid}
                                      error={fieldState.error?.message}
                                      values={values as TValues}
                                    />
                                  )
                                }}
                              />
                            </div>
                          ) : actionRender && actionRenderComponent ? (
                            <div className="shrink-0">
                              <Controller
                                control={engine.form.control}
                                name={fieldName}
                                render={({ field: actionControllerField, fieldState }) => {
                                  const ActionComponent = actionRenderComponent
                                  const currentValues = engine.form.getValues()
                                  const handleActionChange = (nextValue: unknown): void => {
                                    const normalizedValue = field.normalize
                                      ? field.normalize(nextValue, {
                                          values: currentValues,
                                          getValue: (path) => getValueAtPath(currentValues, path)
                                        })
                                      : nextValue

                                    actionControllerField.onChange(normalizedValue)
                                  }

                                  return (
                                    <ActionComponent
                                      field={{
                                        ...field,
                                        action: undefined,
                                        render: actionRender,
                                        props: actionConfig?.props ?? field.props
                                      }}
                                      metadata={field.metadata}
                                      name={fieldName}
                                      value={actionControllerField.value}
                                      onChange={handleActionChange}
                                      onBlur={actionControllerField.onBlur}
                                      disabled={disabled}
                                      invalid={fieldState.invalid}
                                      error={fieldState.error?.message}
                                      values={values as TValues}
                                    />
                                  )
                                }}
                              />
                            </div>
                          ) : actionSlot !== null && actionSlot !== undefined ? (
                            <div className="shrink-0">
                              <Controller
                                control={engine.form.control}
                                name={fieldName}
                                render={({ field: actionControllerField, fieldState }) => {
                                  const currentValues = engine.form.getValues()
                                  const handleActionChange = (nextValue: unknown): void => {
                                    const normalizedValue = field.normalize
                                      ? field.normalize(nextValue, {
                                          values: currentValues,
                                          getValue: (path) => getValueAtPath(currentValues, path)
                                        })
                                      : nextValue

                                    actionControllerField.onChange(normalizedValue)
                                  }

                                  if (typeof actionSlot === 'function') {
                                    return (
                                      <>
                                        {actionSlot({
                                          field,
                                          metadata: field.metadata,
                                          name: fieldName,
                                          value: actionControllerField.value,
                                          onChange: handleActionChange,
                                          onBlur: actionControllerField.onBlur,
                                          disabled,
                                          invalid: fieldState.invalid,
                                          error: fieldState.error?.message,
                                          values: values as TValues
                                        })}
                                      </>
                                    )
                                  }

                                  return <>{actionSlot}</>
                                }}
                              />
                            </div>
                          ) : null}
                        </div>

                        <Controller
                          control={engine.form.control}
                          name={fieldName}
                          render={({ field: controllerField, fieldState }) => {
                            const currentValues = engine.form.getValues()
                            const handleChange = (nextValue: unknown): void => {
                              const normalizedValue = field.normalize
                                ? field.normalize(nextValue, {
                                    values: currentValues,
                                    getValue: (path) => getValueAtPath(currentValues, path)
                                  })
                                : nextValue

                              controllerField.onChange(normalizedValue)
                            }

                            return (
                              <Fragment>
                                <FieldComponent
                                  field={field}
                                  metadata={field.metadata}
                                  name={fieldName}
                                  value={controllerField.value}
                                  onChange={handleChange}
                                  onBlur={controllerField.onBlur}
                                  disabled={disabled}
                                  invalid={fieldState.invalid}
                                  error={fieldState.error?.message}
                                  values={values as TValues}
                                />
                                {fieldState.error?.message ? (
                                  <p className={cn('text-[11px] text-rose-600', errorClassName)}>
                                    {fieldState.error.message}
                                  </p>
                                ) : null}
                              </Fragment>
                            )
                          }}
                        />
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
          </section>
        )
      })}
    </div>
  )
}

export default DynamicFormRenderer
