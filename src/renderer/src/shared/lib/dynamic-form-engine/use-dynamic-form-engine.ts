import { useCallback, useMemo, useState } from 'react'
import {
  useForm,
  type FieldValues,
  type Path,
  type SubmitErrorHandler
} from 'react-hook-form'

import { buildDynamicFormDefaultValues } from './default-values'
import { analyzeDynamicFormDefinitions, buildDynamicFormLayout } from './layout-utils'
import type {
  DynamicFormEngineOptions,
  DynamicFormEngineResult,
  DynamicFormSubmitInvalidHandler,
  DynamicFormValidationResult
} from './types'
import { validateValuesWithSchema } from './validation'

export function useDynamicFormEngine<TValues extends FieldValues = FieldValues>(
  options: DynamicFormEngineOptions<TValues>
): DynamicFormEngineResult<TValues> {
  const { fields, layout, schema, schemaDefaultValues, defaultValues, componentMap, formOptions } = options

  const resolvedDefaultValues = useMemo(
    () =>
      buildDynamicFormDefaultValues({
        fields,
        schemaDefaultValues,
        defaultValues
      }),
    [defaultValues, fields, schemaDefaultValues]
  )

  const form = useForm<TValues>({
    mode: 'onSubmit',
    reValidateMode: 'onChange',
    ...formOptions,
    defaultValues: resolvedDefaultValues
  })

  const resolvedLayout = useMemo(() => buildDynamicFormLayout(fields, layout), [fields, layout])
  const definitionIssues = useMemo(
    () => analyzeDynamicFormDefinitions(fields, layout, componentMap),
    [componentMap, fields, layout]
  )
  const [formErrors, setFormErrors] = useState<string[]>([])

  const validateWithSchema = useCallback(
    (values: TValues): DynamicFormValidationResult<TValues> => {
      form.clearErrors()
      const validationResult = validateValuesWithSchema(schema, values)

      if (validationResult.success) {
        setFormErrors([])
        return validationResult
      }

      validationResult.errors.fieldErrors.forEach((fieldError) => {
        form.setError(fieldError.path as Path<TValues>, {
          type: `zod:${fieldError.code}`,
          message: fieldError.message
        })
      })

      setFormErrors(validationResult.errors.formErrors)
      return validationResult
    },
    [form, schema]
  )

  const runValidation = useCallback((): DynamicFormValidationResult<TValues> => {
    const values = form.getValues()
    return validateWithSchema(values)
  }, [form, validateWithSchema])

  const handleValidatedSubmit = useCallback(
    (
      onValid: (values: TValues) => void | Promise<void>,
      onInvalid?: DynamicFormSubmitInvalidHandler,
      onNativeInvalid?: SubmitErrorHandler<TValues>
    ) =>
      form.handleSubmit(
        async (values) => {
          const validationResult = validateWithSchema(values)
          if (!validationResult.success) {
            onInvalid?.(validationResult.errors)
            return
          }

          await onValid(validationResult.data)
        },
        (nativeErrors) => {
          onNativeInvalid?.(nativeErrors)
        }
      ),
    [form, validateWithSchema]
  )

  return {
    form,
    layout: resolvedLayout,
    fields,
    definitionIssues,
    formErrors,
    validateWithSchema,
    runValidation,
    handleValidatedSubmit
  }
}
