export interface CodeRegion {
  start: number
  end: number
}

export function findCodeRegions(text: string): CodeRegion[] {
  const regions: CodeRegion[] = []

  const fencedRe = /(^|\n)(```|~~~)[^\n]*\n[\s\S]*?(?:\n\2(?:\n|$)|$)/g
  for (const match of text.matchAll(fencedRe)) {
    const start = (match.index ?? 0) + match[1].length
    regions.push({ start, end: start + match[0].length - match[1].length })
  }

  const inlineRe = /`+[^`]+`+/g
  for (const match of text.matchAll(inlineRe)) {
    const start = match.index ?? 0
    const end = start + match[0].length
    const insideFenced = regions.some((region) => start >= region.start && end <= region.end)
    if (!insideFenced) {
      regions.push({ start, end })
    }
  }

  regions.sort((left, right) => left.start - right.start)
  return regions
}

export function isInsideCode(pos: number, regions: CodeRegion[]): boolean {
  return regions.some((region) => pos >= region.start && pos < region.end)
}
