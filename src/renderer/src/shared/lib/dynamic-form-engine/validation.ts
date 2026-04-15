import type { FieldValues } from 'react-hook-form'
import type { ZodIssue, ZodType } from 'zod'

import type {
  DynamicFormFieldError,
  DynamicFormValidationErrors,
  DynamicFormValidationResult
} from './types'

export function zodPathToFieldPath(path: Array<string | number>): string {
  return path.map((entry) => String(entry)).join('.')
}

export function mapZodIssuesToValidationErrors(issues: ZodIssue[]): DynamicFormValidationErrors {
  const fieldErrorMap = new Map<string, DynamicFormFieldError>()
  const formErrors: string[] = []

  issues.forEach((issue) => {
    const mappedPath = zodPathToFieldPath(issue.path as Array<string | number>)

    if (!mappedPath) {
      formErrors.push(issue.message)
      return
    }

    if (fieldErrorMap.has(mappedPath)) {
      return
    }

    fieldErrorMap.set(mappedPath, {
      path: mappedPath,
      message: issue.message,
      code: issue.code
    })
  })

  return {
    fieldErrors: Array.from(fieldErrorMap.values()),
    formErrors
  }
}

export function validateValuesWithSchema<TValues extends FieldValues>(
  schema: ZodType<TValues> | undefined,
  values: TValues
): DynamicFormValidationResult<TValues> {
  if (!schema) {
    return { success: true, data: values }
  }

  const parsedResult = schema.safeParse(values)
  if (parsedResult.success) {
    return {
      success: true,
      data: parsedResult.data
    }
  }

  return {
    success: false,
    errors: mapZodIssuesToValidationErrors(parsedResult.error.issues)
  }
}
