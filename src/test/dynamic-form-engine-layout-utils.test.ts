import { describe, expect, it } from 'vitest'

import {
  analyzeDynamicFormDefinitions,
  buildDynamicFormLayout
} from '../renderer/src/shared/lib/dynamic-form-engine/layout-utils'
import type { DynamicFormField, DynamicFormLayoutGroup } from '../renderer/src/shared/lib/dynamic-form-engine/types'

type MockValues = {
  basic: {
    workspace: string
    repoRoot: string
  }
  tools: {
    allow: string[]
  }
}

const fields: DynamicFormField<MockValues>[] = [
  {
    id: 'basic.workspace',
    metadata: { label: 'workspace' },
    render: 'input'
  },
  {
    id: 'basic.repoRoot',
    metadata: { label: 'repoRoot' },
    render: 'input'
  },
  {
    id: 'tools.allow',
    metadata: { label: 'allow' },
    render: 'textareaArray'
  }
]

const layout: DynamicFormLayoutGroup[] = [
  {
    group: '基础配置',
    rows: [
      { rowKey: 'basic-r1', fields: ['basic.workspace'] },
      { rowKey: 'basic-r2', fields: ['basic.repoRoot'] }
    ]
  },
  {
    group: '工具配置',
    rows: [{ rowKey: 'tools-r1', fields: ['tools.allow'] }]
  }
]

describe('dynamic-form-engine/layout-utils', () => {
  it('builds grouped layout with explicit rows', () => {
    const resolved = buildDynamicFormLayout(fields, layout)
    expect(resolved.map((entry) => entry.id)).toEqual(['基础配置', '工具配置'])
    expect(resolved[0]?.rows.map((row) => row.rowKey)).toEqual(['basic-r1', 'basic-r2'])
    expect(resolved[0]?.rows[0]?.fields[0]?.id).toBe('basic.workspace')
    expect(resolved[1]?.rows[0]?.fields[0]?.id).toBe('tools.allow')
  })

  it('uses layout row field order as render order', () => {
    const customLayout: DynamicFormLayoutGroup[] = [
      {
        group: '基础配置',
        rows: [{ rowKey: 'basic-r1', fields: ['basic.repoRoot', 'basic.workspace'] }]
      }
    ]

    const resolved = buildDynamicFormLayout(fields, customLayout)
    expect(resolved[0]?.rows[0]?.fields.map((field) => field.id)).toEqual([
      'basic.repoRoot',
      'basic.workspace'
    ])
  })

  it('reports declaration issues', () => {
    const issues = analyzeDynamicFormDefinitions(
      [
        ...fields,
        {
          id: 'basic.workspace',
          metadata: { label: '' },
          render: 'missing'
        }
      ],
      [
        ...layout,
        {
          group: '工具配置',
          rows: [{ rowKey: 'tools-r2', fields: ['tools.allow', 'tools.not-exists'] }]
        }
      ],
      {
        input: () => null
      }
    )

    expect(issues.some((issue) => issue.code === 'duplicate_field_id')).toBe(true)
    expect(issues.some((issue) => issue.code === 'missing_component')).toBe(true)
    expect(issues.some((issue) => issue.code === 'duplicate_layout_field')).toBe(true)
    expect(issues.some((issue) => issue.code === 'layout_field_not_found')).toBe(true)
    expect(issues.some((issue) => issue.code === 'field_not_in_layout')).toBe(false)
  })

  it('treats action-referenced field as placed in layout', () => {
    const actionFields: DynamicFormField<MockValues>[] = [
      {
        id: 'tools.elevatedEnabled',
        metadata: { label: 'elevatedEnabled' },
        render: 'switch'
      },
      {
        id: 'tools.allow',
        metadata: { label: 'allow' },
        render: 'textareaArray',
        action: {
          fieldId: 'tools.elevatedEnabled'
        }
      }
    ]

    const actionLayout: DynamicFormLayoutGroup[] = [
      {
        group: '工具配置',
        rows: [{ rowKey: 'tools-r1', fields: ['tools.allow'] }]
      }
    ]

    const issues = analyzeDynamicFormDefinitions(actionFields, actionLayout, {
      switch: () => null,
      textareaArray: () => null
    })

    expect(
      issues.some(
        (issue) => issue.code === 'field_not_in_layout' && issue.fieldId === 'tools.elevatedEnabled'
      )
    ).toBe(false)
  })

  it('reports warning when action references unknown field', () => {
    const actionFields: DynamicFormField<MockValues>[] = [
      {
        id: 'tools.allow',
        metadata: { label: 'allow' },
        render: 'textareaArray',
        action: {
          fieldId: 'tools.not-exists'
        }
      }
    ]

    const actionLayout: DynamicFormLayoutGroup[] = [
      {
        group: '工具配置',
        rows: [{ rowKey: 'tools-r1', fields: ['tools.allow'] }]
      }
    ]

    const issues = analyzeDynamicFormDefinitions(actionFields, actionLayout, {
      textareaArray: () => null
    })

    expect(issues.some((issue) => issue.code === 'action_field_not_found')).toBe(true)
  })
})
