import { Extension } from '@tiptap/core'
import { Plugin } from '@tiptap/pm/state'
import type { EditorView } from '@tiptap/pm/view'
import { nanoid } from 'nanoid'
import { translateWithAppLanguage } from '@/shared/i18n/app-i18n'
import { FileParserRegistry } from './FileParserRegistry'
import { FileUploadManager } from './FileUploadManager'
import type {
  DragDropConfig,
  DragDropEvent,
  DragDropFileItem,
  DragDropFileOptions,
  DragDropFileStatus,
  InsertTarget
} from './DragDropFile.types'
import { resolveFileType, validateFiles } from './DragDropFile.utils'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    dragDropFile: {
      insertFiles: (files: File[] | FileList) => ReturnType
    }
  }
}

const DEFAULT_CONFIG: DragDropConfig = {
  parseableExtensions: [],
  imageExtensions: [],
  maxFileSizeMB: 20,
  maxFiles: 20,
  concurrentUploads: 3,
  enableNumbering: true
}

function processFiles(
  files: File[],
  options: DragDropFileOptions,
  manager: FileUploadManager
): boolean {
  if (files.length === 0) {
    return false
  }

  const inserter = options.inserter
  if (!inserter) {
    console.warn('[DragDropFile] inserter is not configured.')
    return false
  }

  const config: DragDropConfig = {
    ...DEFAULT_CONFIG,
    ...options.config
  }
  const uploadAdapter = options.uploadAdapter
  const parserRegistry = new FileParserRegistry(options.parsers ?? [])
  manager.setAdapter(uploadAdapter)
  manager.setConcurrency(config.concurrentUploads ?? 1)

  const batchId = nanoid()
  const { validFiles, rejections } = validateFiles(files, config)

  rejections.forEach((rejection) => {
    options.onEvent?.({
      type: 'file:rejected',
      batchId,
      file: rejection.file,
      code: rejection.code,
      message: rejection.message
    })
  })

  const items: DragDropFileItem[] = []
  const insertTargetMap = new Map<string, InsertTarget | undefined>()

  validFiles.forEach((file, index) => {
    const parser = parserRegistry.getParser(file)
    const resolved = resolveFileType(file, config, parser)
    if (!resolved) {
      options.onEvent?.({
        type: 'file:rejected',
        batchId,
        file,
        code: 'parser_not_found',
        message: translateWithAppLanguage('chat.dragDrop.error.noParser')
      })
      return
    }

    const type = resolved.type
    const item: DragDropFileItem = {
      id: nanoid(),
      file,
      type,
      status: 'queued'
    }

    const target =
      options.resolveInsertTarget?.({
        batchId,
        index,
        file,
        type,
        sequence: item.sequence,
        sequenceType: item.sequenceType
      }) ?? config.insertTarget

    insertTargetMap.set(item.id, target)
    items.push(item)
  })

  if (items.length === 0) {
    return true
  }

  const emit = (payload: DragDropEvent): void => {
    options.onEvent?.(payload)
  }

  emit({
    type: 'batch:start',
    batchId,
    items,
    files: items.map((item) => item.file)
  })

  let pending = items.length
  const finalize = (): void => {
    pending -= 1
    if (pending <= 0) {
      emit({ type: 'batch:complete', batchId, items })
    }
  }

  items.forEach((item, index) => {
    const target = insertTargetMap.get(item.id)
    const placeholderLabel =
      options.placeholderLabel?.({
        batchId,
        index,
        file: item.file,
        type: item.type,
        sequence: item.sequence,
        sequenceType: item.sequenceType
      }) ?? item.file.name

    inserter.insertPlaceholder(item.id, placeholderLabel, undefined, target)
    emit({ type: 'file:placeholder', batchId, item })
    emit({ type: 'file:queued', batchId, item })

    const updatePlaceholder = (patch: {
      status?: DragDropFileStatus
      progress?: number
      error?: string
    }): void => {
      inserter.updatePlaceholder?.(item.id, patch, target)
    }

    if (item.type === 'parseable') {
      const parser = parserRegistry.getParser(item.file)
      if (!parser) {
        item.status = 'error'
        item.error = translateWithAppLanguage('chat.dragDrop.error.noParser')
        updatePlaceholder({ status: 'error', error: item.error })
        emit({
          type: 'file:error',
          batchId,
          item,
          error: item.error
        })
        finalize()
        return
      }

      item.status = 'parsing'
      updatePlaceholder({ status: 'parsing' })

      parser
        .parse(item.file)
        .then((result) => {
          item.status = 'success'
          item.result = result
          inserter.replacePlaceholder(
            item.id,
            {
              type: 'tag',
              label: item.file.name,
              content: result.content,
              metadata: result.metadata,
              sequence: item.sequence,
              sequenceType: item.sequenceType
            },
            target
          )
          emit({
            type: 'file:parsed',
            batchId,
            item,
            result
          })
          emit({
            type: 'file:success',
            batchId,
            item,
            result
          })
          finalize()
        })
        .catch((error: unknown) => {
          item.status = 'error'
          item.error =
            error instanceof Error
              ? error.message
              : translateWithAppLanguage('chat.dragDrop.error.parseFailed')
          updatePlaceholder({ status: 'error', error: item.error })
          emit({
            type: 'file:error',
            batchId,
            item,
            error: item.error
          })
          finalize()
        })
      return
    }

    if (!uploadAdapter) {
      item.status = 'error'
      item.error = translateWithAppLanguage('chat.dragDrop.error.noUploadAdapter')
      updatePlaceholder({ status: 'error', error: item.error })
      emit({
        type: 'file:error',
        batchId,
        item,
        error: item.error
      })
      finalize()
      return
    }

    manager.enqueue({
      id: item.id,
      file: item.file,
      onProgress: (progress) => {
        item.progress = progress
        emit({
          type: 'file:progress',
          batchId,
          item,
          progress
        })
        updatePlaceholder({ progress })
      },
      onStatus: (status) => {
        item.status = status
        updatePlaceholder({ status })
      },
      onSuccess: (result) => {
        item.status = 'success'
        item.result = result
        inserter.replacePlaceholder(
          item.id,
          item.type === 'image'
            ? {
                type: 'image',
                url: result.url,
                fileName: item.file.name,
                metadata: result.metadata
              }
            : {
                type: 'attachment',
                fileName: item.file.name,
                metadata: result.metadata
              },
          target
        )
        emit({
          type: 'file:success',
          batchId,
          item,
          result
        })
        finalize()
      },
      onError: (error) => {
        item.status = 'error'
        item.error =
          error instanceof Error
            ? error.message
            : translateWithAppLanguage('chat.dragDrop.error.uploadFailed')
        updatePlaceholder({ status: 'error', error: item.error })
        emit({
          type: 'file:error',
          batchId,
          item,
          error: item.error
        })
        finalize()
      }
    })
  })

  // Keep cursor flow natural after media insertion.
  inserter.appendSpace?.()

  return true
}

export const DragDropFile = Extension.create<DragDropFileOptions>({
  name: 'dragDropFile',

  addOptions() {
    return {
      uploadAdapter: undefined,
      parsers: [],
      inserter: undefined,
      config: DEFAULT_CONFIG,
      onEvent: undefined,
      resolveInsertTarget: undefined,
      placeholderLabel: undefined
    }
  },

  addStorage() {
    return {
      manager: new FileUploadManager(
        this.options.uploadAdapter,
        this.options.config?.concurrentUploads ?? DEFAULT_CONFIG.concurrentUploads
      )
    }
  },

  addCommands() {
    return {
      insertFiles: (fileList: File[] | FileList) => () => {
        const files = Array.isArray(fileList) ? fileList : Array.from(fileList)
        const manager = this.storage.manager as FileUploadManager
        return processFiles(files, this.options, manager)
      }
    }
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        props: {
          handleDOMEvents: {
            dragover: (view: EditorView, event: DragEvent) => {
              void view
              if (event.dataTransfer) {
                event.dataTransfer.dropEffect = 'copy'
              }
              event.preventDefault()
              return true
            }
          },
          handleDrop: (view: EditorView, event: DragEvent) => {
            void view
            const files = Array.from(event.dataTransfer?.files ?? [])
            if (files.length === 0) {
              return false
            }

            event.preventDefault()
            const manager = this.storage.manager as FileUploadManager
            return processFiles(files, this.options, manager)
          },
          handlePaste: (view: EditorView, event: ClipboardEvent) => {
            void view
            const files = Array.from(event.clipboardData?.files ?? [])
            if (files.length === 0) {
              return false
            }

            event.preventDefault()
            const manager = this.storage.manager as FileUploadManager
            return processFiles(files, this.options, manager)
          }
        }
      })
    ]
  }
})
