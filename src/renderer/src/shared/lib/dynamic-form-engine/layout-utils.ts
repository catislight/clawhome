import type { FieldValues } from 'react-hook-form'

import type {
  DynamicFormComponentMap,
  DynamicFormDefinitionIssue,
  DynamicFormField,
  DynamicFormFieldActionConfig,
  DynamicFormGroupLayout,
  DynamicFormLayoutGroup
} from './types'

function normalizeGroupName(groupName: string): string {
  const normalized = groupName.trim()
  return normalized || 'default'
}

function normalizeFieldId(fieldId: string): string {
  return fieldId.trim()
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

export function analyzeDynamicFormDefinitions<TValues extends FieldValues>(
  fields: DynamicFormField<TValues>[],
  layout: DynamicFormLayoutGroup[],
  componentMap?: DynamicFormComponentMap<TValues>
): DynamicFormDefinitionIssue[] {
  const issues: DynamicFormDefinitionIssue[] = []
  const fieldIdSet = new Set<string>()
  const layoutFieldSet = new Set<string>()
  const actionFieldSet = new Set<string>()

  fields.forEach((field) => {
    const fieldId = normalizeFieldId(String(field.id))
    if (!fieldId) {
      return
    }

    if (fieldIdSet.has(fieldId)) {
      issues.push({
        code: 'duplicate_field_id',
        severity: 'error',
        message: `字段 "${fieldId}" 重复声明，请保持唯一。`,
        fieldId
      })
    } else {
      fieldIdSet.add(fieldId)
    }

    if (!field.metadata.label.trim()) {
      issues.push({
        code: 'empty_label',
        severity: 'warning',
        message: `字段 "${fieldId}" 没有可读标签（label）。`,
        fieldId
      })
    }

    if (componentMap && !componentMap[field.render]) {
      issues.push({
        code: 'missing_component',
        severity: 'error',
        message: `字段 "${fieldId}" 使用 render="${field.render}"，但 componentMap 中未提供实现。`,
        fieldId
      })
    }

    const actionConfig = toActionConfig(field.action)
    const actionFieldId = normalizeFieldId(String(actionConfig?.fieldId ?? ''))
    if (actionFieldId) {
      actionFieldSet.add(actionFieldId)
    }

    const actionRender = String(actionConfig?.render ?? '').trim()
    if (componentMap && actionRender && !componentMap[actionRender]) {
      issues.push({
        code: 'missing_component',
        severity: 'error',
        message: `字段 "${fieldId}" 的 action 使用 render="${actionRender}"，但 componentMap 中未提供实现。`,
        fieldId
      })
    }
  })

  layout.forEach((group) => {
    const groupName = normalizeGroupName(group.group)
    if (!group.group.trim()) {
      issues.push({
        code: 'empty_layout_group',
        severity: 'warning',
        message: '存在未命名分组（group 为空），将自动归入 default。'
      })
    }

    group.rows.forEach((row) => {
      row.fields.forEach((rawFieldId) => {
        const fieldId = normalizeFieldId(rawFieldId)
        if (!fieldId) {
          return
        }

        if (layoutFieldSet.has(fieldId)) {
          issues.push({
            code: 'duplicate_layout_field',
            severity: 'warning',
            message: `字段 "${fieldId}" 在布局中被重复引用（分组：${groupName}，行：${row.rowKey}）。`,
            fieldId
          })
          return
        }

        layoutFieldSet.add(fieldId)
        if (!fieldIdSet.has(fieldId)) {
          issues.push({
            code: 'layout_field_not_found',
            severity: 'warning',
            message: `布局引用了不存在的字段 "${fieldId}"（分组：${groupName}，行：${row.rowKey}）。`,
            fieldId
          })
        }
      })
    })
  })

  actionFieldSet.forEach((fieldId) => {
    if (fieldIdSet.has(fieldId)) {
      return
    }

    issues.push({
      code: 'action_field_not_found',
      severity: 'warning',
      message: `字段 action 引用了不存在的字段 "${fieldId}"。`,
      fieldId
    })
  })

  fieldIdSet.forEach((fieldId) => {
    if (layoutFieldSet.has(fieldId) || actionFieldSet.has(fieldId)) {
      return
    }

    issues.push({
      code: 'field_not_in_layout',
      severity: 'warning',
      message: `字段 "${fieldId}" 未在布局中声明，将不会渲染。`,
      fieldId
    })
  })

  return issues
}

export function buildDynamicFormLayout<TValues extends FieldValues>(
  fields: DynamicFormField<TValues>[],
  layout: DynamicFormLayoutGroup[]
): DynamicFormGroupLayout<TValues>[] {
  const fieldMap = new Map<string, DynamicFormField<TValues>>()
  fields.forEach((field) => {
    const fieldId = normalizeFieldId(String(field.id))
    if (fieldId) {
      fieldMap.set(fieldId, field)
    }
  })

  return layout.map((group) => {
    const rows = group.rows.reduce<DynamicFormGroupLayout<TValues>['rows']>((result, row, rowIndex) => {
      const rowFields = row.fields
        .map((fieldId) => fieldMap.get(normalizeFieldId(fieldId)))
        .filter((field): field is DynamicFormField<TValues> => Boolean(field))

      result.push({
        row: rowIndex + 1,
        rowKey: row.rowKey,
        fields: rowFields
      })

      return result
    }, [])

    return {
      id: normalizeGroupName(group.group),
      rows
    }
  })
}
