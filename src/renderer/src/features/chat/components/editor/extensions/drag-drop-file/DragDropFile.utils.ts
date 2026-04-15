import type {
  DragDropConfig,
  DragDropFileRejectCode,
  DragDropFileType,
  FileParser
} from './DragDropFile.types'
import { translateWithAppLanguage } from '@/shared/i18n/app-i18n'

export interface FileRejection {
  file: File
  code: DragDropFileRejectCode
  message: string
}

export interface ValidationResult {
  validFiles: File[]
  rejections: FileRejection[]
}

export interface ResolveFileTypeResult {
  type: DragDropFileType
  parser?: FileParser
}

const MB = 1024 * 1024

export const normalizeExtensions = (extensions: string[] | undefined): string[] =>
  (extensions ?? []).map((ext) => ext.trim().toLowerCase().replace(/^\./, '')).filter(Boolean)

export const getFileExtension = (file: File): string => {
  const name = file.name || ''
  const index = name.lastIndexOf('.')
  if (index === -1) {
    return ''
  }
  return name.slice(index + 1).toLowerCase()
}

export const isImageFile = (file: File, imageExtensions: string[]): boolean => {
  if (file.type.startsWith('image/')) {
    return true
  }
  const ext = getFileExtension(file)
  return imageExtensions.includes(ext)
}

export const isParseableFile = (
  file: File,
  parseableExtensions: string[],
  parser: FileParser | null
): boolean => {
  const ext = getFileExtension(file)
  if (parseableExtensions.includes(ext)) {
    return true
  }
  return parser !== null
}

export const resolveFileType = (
  file: File,
  config: DragDropConfig,
  parser: FileParser | null
): ResolveFileTypeResult | null => {
  const imageExtensions = normalizeExtensions(config.imageExtensions)
  const parseableExtensions = normalizeExtensions(config.parseableExtensions)

  if (isImageFile(file, imageExtensions)) {
    return { type: 'image' }
  }

  if (isParseableFile(file, parseableExtensions, parser)) {
    if (!parser) {
      return null
    }
    return { type: 'parseable', parser }
  }

  return { type: 'attachment' }
}

export const validateFiles = (files: File[], config: DragDropConfig): ValidationResult => {
  const rejections: FileRejection[] = []
  let validFiles = [...files]

  if (config.maxFiles && validFiles.length > config.maxFiles) {
    const overflow = validFiles.slice(config.maxFiles)
    validFiles = validFiles.slice(0, config.maxFiles)
    overflow.forEach((file) => {
      rejections.push({
        file,
        code: 'max_files',
        message: translateWithAppLanguage('chat.dragDrop.error.maxFiles', {
          maxFiles: config.maxFiles
        })
      })
    })
  }

  if (config.maxFileSizeMB && config.maxFileSizeMB > 0) {
    const maxBytes = config.maxFileSizeMB * MB
    const allowed: File[] = []
    validFiles.forEach((file) => {
      if (file.size > maxBytes) {
        rejections.push({
          file,
          code: 'max_size',
          message: translateWithAppLanguage('chat.dragDrop.error.maxFileSize', {
            maxSize: config.maxFileSizeMB
          })
        })
      } else {
        allowed.push(file)
      }
    })
    validFiles = allowed
  }

  return { validFiles, rejections }
}
