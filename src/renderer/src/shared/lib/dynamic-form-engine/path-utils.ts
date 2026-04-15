type PathToken = string | number

function normalizeBracketToken(rawToken: string): PathToken {
  const trimmedToken = rawToken.trim()
  if (/^\d+$/.test(trimmedToken)) {
    return Number(trimmedToken)
  }

  return trimmedToken
}

export function tokenizePath(path: string): PathToken[] {
  if (!path.trim()) {
    return []
  }

  const tokens: PathToken[] = []
  let buffer = ''
  let index = 0

  const pushBuffer = (): void => {
    const trimmedBuffer = buffer.trim()
    if (trimmedBuffer) {
      tokens.push(trimmedBuffer)
    }
    buffer = ''
  }

  while (index < path.length) {
    const currentChar = path[index]

    if (currentChar === '\\' && index + 1 < path.length) {
      buffer += path[index + 1]
      index += 2
      continue
    }

    if (currentChar === '.') {
      pushBuffer()
      index += 1
      continue
    }

    if (currentChar === '[') {
      pushBuffer()
      index += 1

      while (index < path.length && /\s/.test(path[index])) {
        index += 1
      }

      if (index >= path.length) {
        break
      }

      const quote = path[index]
      if (quote === '"' || quote === "'") {
        index += 1
        let quotedToken = ''
        while (index < path.length) {
          const quotedChar = path[index]
          if (quotedChar === '\\' && index + 1 < path.length) {
            quotedToken += path[index + 1]
            index += 2
            continue
          }

          if (quotedChar === quote) {
            index += 1
            break
          }

          quotedToken += quotedChar
          index += 1
        }

        while (index < path.length && /\s/.test(path[index])) {
          index += 1
        }
        if (path[index] === ']') {
          index += 1
        }

        tokens.push(quotedToken)
        continue
      }

      let rawToken = ''
      while (index < path.length && path[index] !== ']') {
        rawToken += path[index]
        index += 1
      }

      if (path[index] === ']') {
        index += 1
      }

      if (rawToken.trim()) {
        tokens.push(normalizeBracketToken(rawToken))
      }
      continue
    }

    buffer += currentChar
    index += 1
  }

  pushBuffer()
  return tokens
}

function cloneContainer(value: unknown): unknown {
  if (Array.isArray(value)) {
    return [...value]
  }

  if (value && typeof value === 'object') {
    return { ...(value as Record<string, unknown>) }
  }

  return undefined
}

export function getValueAtPath(source: unknown, path: string): unknown {
  const tokens = tokenizePath(path)
  if (tokens.length === 0) {
    return source
  }

  let current: unknown = source
  for (const token of tokens) {
    if (current === null || current === undefined) {
      return undefined
    }

    if (typeof token === 'number') {
      if (!Array.isArray(current)) {
        return undefined
      }
      current = current[token]
      continue
    }

    if (typeof current !== 'object') {
      return undefined
    }
    current = (current as Record<string, unknown>)[token]
  }

  return current
}

export function hasPath(source: unknown, path: string): boolean {
  const tokens = tokenizePath(path)
  if (tokens.length === 0) {
    return source !== undefined
  }

  let current: unknown = source
  for (const token of tokens) {
    if (current === null || current === undefined) {
      return false
    }

    if (typeof token === 'number') {
      if (!Array.isArray(current) || token < 0 || token >= current.length) {
        return false
      }
      current = current[token]
      continue
    }

    if (typeof current !== 'object') {
      return false
    }

    if (!Object.prototype.hasOwnProperty.call(current, token)) {
      return false
    }
    current = (current as Record<string, unknown>)[token]
  }

  return true
}

export function setValueAtPath<TObject>(source: TObject, path: string, value: unknown): TObject {
  const tokens = tokenizePath(path)
  if (tokens.length === 0) {
    return value as TObject
  }

  const firstToken = tokens[0]
  const rootClone =
    cloneContainer(source) ??
    (typeof firstToken === 'number' ? ([] as unknown[]) : ({} as Record<string, unknown>))

  let currentContainer: unknown = rootClone
  for (let index = 0; index < tokens.length - 1; index += 1) {
    const token = tokens[index]
    const nextToken = tokens[index + 1]

    const existingChild =
      typeof token === 'number'
        ? (currentContainer as unknown[])[token]
        : (currentContainer as Record<string, unknown>)[token]

    const nextContainer =
      cloneContainer(existingChild) ??
      (typeof nextToken === 'number' ? ([] as unknown[]) : ({} as Record<string, unknown>))

    if (typeof token === 'number') {
      ;(currentContainer as unknown[])[token] = nextContainer
    } else {
      ;(currentContainer as Record<string, unknown>)[token] = nextContainer
    }

    currentContainer = nextContainer
  }

  const lastToken = tokens[tokens.length - 1]
  if (typeof lastToken === 'number') {
    ;(currentContainer as unknown[])[lastToken] = value
  } else {
    ;(currentContainer as Record<string, unknown>)[lastToken] = value
  }

  return rootClone as TObject
}
