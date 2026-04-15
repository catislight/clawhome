import type { FileParser } from './DragDropFile.types'

export class FileParserRegistry {
  private parsers: FileParser[]

  constructor(parsers: FileParser[] = []) {
    this.parsers = [...parsers]
  }

  register(parser: FileParser): void {
    this.parsers.push(parser)
  }

  getParser(file: File): FileParser | null {
    return this.parsers.find((parser) => parser.supports(file)) ?? null
  }

  list(): FileParser[] {
    return [...this.parsers]
  }
}
