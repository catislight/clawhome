export type DragDropFileStatus =
  | 'idle'
  | 'queued'
  | 'parsing'
  | 'uploading'
  | 'success'
  | 'error'
  | 'canceled'

export type DragDropFileType = 'image' | 'parseable' | 'attachment'

export type DragDropFileRejectCode = 'max_files' | 'max_size' | 'parser_not_found' | 'unsupported'

export interface UploadResult {
  url: string
  metadata?: Record<string, unknown>
}

export interface ParseResult {
  content: string
  metadata?: Record<string, unknown>
}

export interface DragDropFileItem {
  id: string
  file: File
  type: DragDropFileType
  status: DragDropFileStatus
  progress?: number
  error?: string
  result?: UploadResult | ParseResult
  sequence?: number
  sequenceType?: 'image' | 'attachment'
}

export interface DragDropBatch {
  id: string
  items: DragDropFileItem[]
  createdAt: number
}

export interface InsertTarget {
  kind: string
  position?: number
  context?: Record<string, unknown>
}

export interface InsertPayload {
  type: 'image' | 'attachment' | 'tag' | 'error'
  url?: string
  fileName?: string
  label?: string
  content?: string
  metadata?: Record<string, unknown>
  sequence?: number
  sequenceType?: 'image' | 'attachment'
  error?: string
}

export interface UploadAdapter {
  upload(file: File, onProgress?: (progress: number) => void): Promise<UploadResult>
  cancel?(id: string): void
}

export interface FileParser {
  supports(file: File): boolean
  parse(file: File): Promise<ParseResult>
}

export interface EditorInserter {
  insertImage?(
    url: string,
    fileName: string,
    target?: InsertTarget,
    metadata?: Record<string, unknown>
  ): void
  insertAttachment?(
    url: string,
    fileName: string,
    target?: InsertTarget,
    metadata?: Record<string, unknown>
  ): void
  insertTag?(
    label: string,
    content: string,
    target?: InsertTarget,
    metadata?: Record<string, unknown>
  ): void
  insertPlaceholder(id: string, label: string, at?: number, target?: InsertTarget): void
  updatePlaceholder?(
    id: string,
    patch: {
      status?: DragDropFileStatus
      progress?: number
      error?: string
    },
    target?: InsertTarget
  ): void
  replacePlaceholder(id: string, payload: InsertPayload, target?: InsertTarget): void
  appendSpace?(target?: InsertTarget): void
}

export interface DragDropConfig {
  parseableExtensions?: string[]
  imageExtensions?: string[]
  maxFileSizeMB?: number
  maxFiles?: number
  concurrentUploads?: number
  enableNumbering?: boolean
  insertTarget?: InsertTarget
}

export interface InsertTargetContext {
  batchId: string
  index: number
  file: File
  type: DragDropFileType
  sequence?: number
  sequenceType?: 'image' | 'attachment'
}

export interface PlaceholderLabelContext {
  batchId: string
  index: number
  file: File
  type: DragDropFileType
  sequence?: number
  sequenceType?: 'image' | 'attachment'
}

export type DragDropEvent =
  | {
      type: 'batch:start'
      batchId: string
      items: DragDropFileItem[]
      files: File[]
    }
  | {
      type: 'batch:complete'
      batchId: string
      items: DragDropFileItem[]
    }
  | {
      type: 'file:rejected'
      batchId: string
      file: File
      code: DragDropFileRejectCode
      message: string
    }
  | {
      type: 'file:queued'
      batchId: string
      item: DragDropFileItem
    }
  | {
      type: 'file:placeholder'
      batchId: string
      item: DragDropFileItem
    }
  | {
      type: 'file:progress'
      batchId: string
      item: DragDropFileItem
      progress: number
    }
  | {
      type: 'file:parsed'
      batchId: string
      item: DragDropFileItem
      result: ParseResult
    }
  | {
      type: 'file:success'
      batchId: string
      item: DragDropFileItem
      result: UploadResult | ParseResult
    }
  | {
      type: 'file:error'
      batchId: string
      item: DragDropFileItem
      error: string
    }

export interface DragDropFileOptions {
  uploadAdapter?: UploadAdapter
  parsers?: FileParser[]
  inserter?: EditorInserter
  config?: DragDropConfig
  onEvent?: (event: DragDropEvent) => void
  resolveInsertTarget?: (context: InsertTargetContext) => InsertTarget | undefined
  placeholderLabel?: (context: PlaceholderLabelContext) => string
}

export interface UploadTask {
  id: string
  file: File
  onProgress?: (progress: number) => void
  onStatus?: (status: DragDropFileStatus) => void
  onSuccess?: (result: UploadResult) => void
  onError?: (error: unknown) => void
}
