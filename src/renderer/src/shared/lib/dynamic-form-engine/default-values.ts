import type { DefaultValues, FieldValues } from 'react-hook-form'

import { hasPath, setValueAtPath } from './path-utils'
import type { DynamicFormField } from './types'

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Object.prototype.toString.call(value) === '[object Object]'
}

export function deepClone<TValue>(value: TValue): TValue {
  if (Array.isArray(value)) {
    return value.map((entry) => deepClone(entry)) as TValue
  }

  if (isPlainObject(value)) {
    const clonedObject: Record<string, unknown> = {}
    for (const [key, entry] of Object.entries(value)) {
      clonedObject[key] = deepClone(entry)
    }
    return clonedObject as TValue
  }

  return value
}

export function deepMerge<TTarget extends Record<string, unknown>>(
  target: TTarget,
  source: Record<string, unknown>
): TTarget {
  const mergedObject: Record<string, unknown> = { ...target }

  for (const [key, sourceValue] of Object.entries(source)) {
    const currentTargetValue = mergedObject[key]

    if (isPlainObject(currentTargetValue) && isPlainObject(sourceValue)) {
      mergedObject[key] = deepMerge(currentTargetValue, sourceValue)
      continue
    }

    mergedObject[key] = deepClone(sourceValue)
  }

  return mergedObject as TTarget
}

function applyFieldDefaultValues<TValues extends FieldValues>(
  initialObject: Record<string, unknown>,
  fields: DynamicFormField<TValues>[]
): Record<string, unknown> {
  let nextObject = initialObject

  for (const field of fields) {
    if (field.defaultValue === undefined) {
      continue
    }

    if (hasPath(nextObject, String(field.id))) {
      continue
    }

    nextObject = setValueAtPath(nextObject, String(field.id), deepClone(field.defaultValue))
  }

  return nextObject
}

type BuildDynamicFormDefaultValuesOptions<TValues extends FieldValues> = {
  fields: DynamicFormField<TValues>[]
  schemaDefaultValues?: Partial<TValues>
  defaultValues?: DefaultValues<TValues>
}

export function buildDynamicFormDefaultValues<TValues extends FieldValues>({
  fields,
  schemaDefaultValues,
  defaultValues
}: BuildDynamicFormDefaultValuesOptions<TValues>): DefaultValues<TValues> {
  const schemaDefaults = deepClone((schemaDefaultValues ?? {}) as Record<string, unknown>)
  const defaultsWithFieldValues = applyFieldDefaultValues(schemaDefaults, fields)
  const explicitDefaults = deepClone((defaultValues ?? {}) as Record<string, unknown>)
  const mergedDefaults = deepMerge(defaultsWithFieldValues, explicitDefaults)

  return mergedDefaults as DefaultValues<TValues>
}
