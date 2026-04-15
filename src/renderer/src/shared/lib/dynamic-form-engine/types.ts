import type { BaseSyntheticEvent, ComponentType, ReactNode } from 'react'
import type {
  DefaultValues,
  FieldValues,
  Path,
  SubmitErrorHandler,
  UseFormProps,
  UseFormReturn
} from 'react-hook-form'
import type { ZodType } from 'zod'

export type DynamicFieldConditionContext<TValues extends FieldValues = FieldValues> = {
  values: TValues
  getValue: (path: string) => unknown
}

export type DynamicFieldMetadata = {
  label: string
  desc?: string
}

export type DynamicFormFieldActionConfig<TValues extends FieldValues = FieldValues> = {
  fieldId?: Path<TValues> | string
  render?: string
  props?: Record<string, unknown>
}

export type DynamicFormFieldActionRender<TValues extends FieldValues = FieldValues> = (
  props: DynamicFormComponentProps<TValues>
) => ReactNode

export type DynamicFormFieldAction<TValues extends FieldValues = FieldValues> =
  | DynamicFormFieldActionConfig<TValues>
  | DynamicFormFieldActionRender<TValues>
  | ReactNode

export type DynamicFormField<TValues extends FieldValues = FieldValues> = {
  id: Path<TValues> | string
  metadata: DynamicFieldMetadata
  render: string
  action?: DynamicFormFieldAction<TValues>
  props?: Record<string, unknown>
  defaultValue?: unknown
  visibleWhen?: (context: DynamicFieldConditionContext<TValues>) => boolean
  disabledWhen?: (context: DynamicFieldConditionContext<TValues>) => boolean
  normalize?: (value: unknown, context: DynamicFieldConditionContext<TValues>) => unknown
}

export type DynamicFormLayoutRow = {
  rowKey: string
  fields: string[]
}

export type DynamicFormLayoutGroup = {
  group: string
  rows: DynamicFormLayoutRow[]
}

export type DynamicFormComponentProps<TValues extends FieldValues = FieldValues> = {
  field: DynamicFormField<TValues>
  metadata: DynamicFieldMetadata
  name: string
  value: unknown
  onChange: (value: unknown) => void
  onBlur: () => void
  disabled: boolean
  invalid: boolean
  error?: string
  values: TValues
}

export type DynamicFormComponentMap<TValues extends FieldValues = FieldValues> = Record<
  string,
  ComponentType<DynamicFormComponentProps<TValues>>
>

export type DynamicFormResolvedRow<TValues extends FieldValues = FieldValues> = {
  row: number
  fields: DynamicFormField<TValues>[]
  rowKey: string
}

export type DynamicFormGroupLayout<TValues extends FieldValues = FieldValues> = {
  id: string
  rows: DynamicFormResolvedRow<TValues>[]
}

export type DynamicFormDefinitionIssueCode =
  | 'duplicate_field_id'
  | 'missing_component'
  | 'action_field_not_found'
  | 'empty_label'
  | 'empty_layout_group'
  | 'duplicate_layout_field'
  | 'layout_field_not_found'
  | 'field_not_in_layout'

export type DynamicFormDefinitionIssue = {
  code: DynamicFormDefinitionIssueCode
  severity: 'error' | 'warning'
  message: string
  fieldId?: string
}

export type DynamicFormFieldError = {
  path: string
  message: string
  code: string
}

export type DynamicFormValidationErrors = {
  fieldErrors: DynamicFormFieldError[]
  formErrors: string[]
}

export type DynamicFormValidationSuccess<TValues extends FieldValues = FieldValues> = {
  success: true
  data: TValues
}

export type DynamicFormValidationFailure = {
  success: false
  errors: DynamicFormValidationErrors
}

export type DynamicFormValidationResult<TValues extends FieldValues = FieldValues> =
  | DynamicFormValidationSuccess<TValues>
  | DynamicFormValidationFailure

export type DynamicFormSubmitInvalidHandler = (errors: DynamicFormValidationErrors) => void

export type DynamicFormEngineOptions<TValues extends FieldValues = FieldValues> = {
  fields: DynamicFormField<TValues>[]
  layout: DynamicFormLayoutGroup[]
  schema?: ZodType<TValues>
  schemaDefaultValues?: Partial<TValues>
  defaultValues?: DefaultValues<TValues>
  componentMap?: DynamicFormComponentMap<TValues>
  formOptions?: Omit<UseFormProps<TValues>, 'defaultValues'>
}

export type DynamicFormEngineResult<TValues extends FieldValues = FieldValues> = {
  form: UseFormReturn<TValues>
  layout: DynamicFormGroupLayout<TValues>[]
  fields: DynamicFormField<TValues>[]
  definitionIssues: DynamicFormDefinitionIssue[]
  formErrors: string[]
  validateWithSchema: (values: TValues) => DynamicFormValidationResult<TValues>
  runValidation: () => DynamicFormValidationResult<TValues>
  handleValidatedSubmit: (
    onValid: (values: TValues) => void | Promise<void>,
    onInvalid?: DynamicFormSubmitInvalidHandler,
    onNativeInvalid?: SubmitErrorHandler<TValues>
  ) => (event?: BaseSyntheticEvent) => Promise<void>
}
