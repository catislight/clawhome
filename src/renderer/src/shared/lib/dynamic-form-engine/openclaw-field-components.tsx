import { useEffect, useMemo, useState } from 'react'
import type { FieldValues } from 'react-hook-form'

import { Input } from '@/shared/ui/input'
import { Select, type SelectOption } from '@/shared/ui/select'
import { Switch } from '@/shared/ui/switch'
import { Textarea } from '@/shared/ui/textarea'
import type { DynamicFormComponentMap, DynamicFormComponentProps } from './types'

type SelectLikeFieldProps = {
  options?: SelectOption[]
  placeholder?: string
}

type ArrayFieldProps = {
  unique?: boolean
  trim?: boolean
  emptyAsBlank?: boolean
}

type KeyValueFieldProps = {
  rows?: number
}

function getStringValue(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function getBooleanValue(value: unknown): boolean {
  return value === true
}

function getStringArrayValue(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value.map((entry) => String(entry))
}

function splitMultilineValues(value: string, options?: ArrayFieldProps): string[] {
  const trim = options?.trim ?? true
  const unique = options?.unique ?? true
  const emptyAsBlank = options?.emptyAsBlank ?? false

  const list = value
    .split('\n')
    .map((entry) => (trim ? entry.trim() : entry))
    .filter((entry) => (emptyAsBlank ? true : entry.length > 0))

  if (!unique) {
    return list
  }

  return Array.from(new Set(list))
}

function safeJsonParse(value: string): { success: true; data: Record<string, unknown> } | { success: false } {
  if (!value.trim()) {
    return { success: true, data: {} }
  }

  try {
    const parsed = JSON.parse(value)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return { success: true, data: parsed as Record<string, unknown> }
    }
  } catch {
    return { success: false }
  }

  return { success: false }
}

function InputField<TValues extends FieldValues = FieldValues>({
  name,
  metadata,
  value,
  onChange,
  onBlur,
  disabled
}: DynamicFormComponentProps<TValues>): React.JSX.Element {
  return (
    <Input
      id={name}
      density="sm"
      value={getStringValue(value)}
      placeholder={metadata.desc ?? metadata.label}
      disabled={disabled}
      onBlur={onBlur}
      onChange={(event) => {
        onChange(event.target.value)
      }}
    />
  )
}

function SwitchField<TValues extends FieldValues = FieldValues>({
  name,
  value,
  onChange,
  disabled
}: DynamicFormComponentProps<TValues>): React.JSX.Element {
  return (
    <div className="flex h-9 items-center">
      <Switch
        id={name}
        checked={getBooleanValue(value)}
        disabled={disabled}
        onCheckedChange={(checked) => {
          onChange(checked)
        }}
      />
    </div>
  )
}

function SelectField<TValues extends FieldValues = FieldValues>({
  metadata,
  value,
  onChange,
  disabled,
  field
}: DynamicFormComponentProps<TValues>): React.JSX.Element {
  const props = (field.props ?? {}) as SelectLikeFieldProps
  const options = props.options ?? []

  return (
    <Select
      value={getStringValue(value)}
      options={options}
      ariaLabel={metadata.label}
      placeholder={props.placeholder ?? '请选择'}
      disabled={disabled}
      triggerClassName="h-9 rounded-[0.7rem] px-3"
      onValueChange={(nextValue) => {
        onChange(nextValue)
      }}
    />
  )
}

function TextareaField<TValues extends FieldValues = FieldValues>({
  name,
  metadata,
  value,
  onChange,
  onBlur,
  disabled
}: DynamicFormComponentProps<TValues>): React.JSX.Element {
  return (
    <Textarea
      id={name}
      density="sm"
      value={getStringValue(value)}
      placeholder={metadata.desc ?? metadata.label}
      disabled={disabled}
      className="min-h-24"
      onBlur={onBlur}
      onChange={(event) => {
        onChange(event.target.value)
      }}
    />
  )
}

function TextareaArrayField<TValues extends FieldValues = FieldValues>({
  name,
  metadata,
  value,
  onChange,
  onBlur,
  disabled,
  field
}: DynamicFormComponentProps<TValues>): React.JSX.Element {
  const arrayValue = getStringArrayValue(value)
  const props = (field.props ?? {}) as ArrayFieldProps

  return (
    <Textarea
      id={name}
      density="sm"
      value={arrayValue.join('\n')}
      placeholder={metadata.desc ?? '每行一个值'}
      disabled={disabled}
      className="min-h-24 font-mono text-xs"
      onBlur={onBlur}
      onChange={(event) => {
        onChange(splitMultilineValues(event.target.value, props))
      }}
    />
  )
}

function KeyValueEditorField<TValues extends FieldValues = FieldValues>({
  name,
  value,
  onChange,
  onBlur,
  disabled,
  invalid,
  error,
  field
}: DynamicFormComponentProps<TValues>): React.JSX.Element {
  const rows = Math.max(4, Number((field.props as KeyValueFieldProps | undefined)?.rows ?? 8))
  const serializedValue = useMemo(() => {
    const safeObject = value && typeof value === 'object' && !Array.isArray(value) ? value : {}
    return JSON.stringify(safeObject, null, 2)
  }, [value])
  const [draftValue, setDraftValue] = useState(serializedValue)
  const [localError, setLocalError] = useState<string | null>(null)

  useEffect(() => {
    setDraftValue(serializedValue)
    setLocalError(null)
  }, [serializedValue])

  return (
    <div className="space-y-1.5">
      <Textarea
        id={name}
        density="sm"
        value={draftValue}
        disabled={disabled}
        className="min-h-24 font-mono text-xs"
        style={{ minHeight: `${rows * 1.4}rem` }}
        onBlur={onBlur}
        onChange={(event) => {
          const nextText = event.target.value
          setDraftValue(nextText)

          const parsed = safeJsonParse(nextText)
          if (parsed.success) {
            setLocalError(null)
            onChange(parsed.data)
            return
          }

          setLocalError('JSON 需为对象格式')
        }}
      />
      {(localError || (invalid && error)) ? (
        <p className="text-[11px] text-rose-600">JSON 需为对象格式，示例：{`{"alias":"main"}`}</p>
      ) : null}
    </div>
  )
}

const OPENCLAW_DYNAMIC_FORM_COMPONENT_MAP_BASE: DynamicFormComponentMap = {
  input: InputField,
  switch: SwitchField,
  select: SelectField,
  textarea: TextareaField,
  textareaArray: TextareaArrayField,
  keyValueEditor: KeyValueEditorField
}

export function createOpenClawDynamicFormComponentMap<
  TValues extends FieldValues = FieldValues
>(): DynamicFormComponentMap<TValues> {
  return OPENCLAW_DYNAMIC_FORM_COMPONENT_MAP_BASE as DynamicFormComponentMap<TValues>
}

export const OPENCLAW_DYNAMIC_FORM_COMPONENT_MAP = OPENCLAW_DYNAMIC_FORM_COMPONENT_MAP_BASE
