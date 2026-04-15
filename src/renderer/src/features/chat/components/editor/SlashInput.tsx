import type { Content, Editor, JSONContent } from '@tiptap/core'
import Placeholder from '@tiptap/extension-placeholder'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { Paperclip } from 'lucide-react'
import {
  forwardRef,
  type ReactNode,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState
} from 'react'

import { Button } from '@/shared/ui/button'
import DialogShell from '@/shared/ui/dialog-shell'
import { useAppI18n } from '@/shared/i18n/app-i18n'
import ImagePreviewOverlay from '@/shared/ui/image-preview-overlay'
import { cn } from '@/shared/lib/utils'
import {
  CHAT_INPUT_DRAG_DROP_CONFIG,
  CHAT_INPUT_IMAGE_EXTENSIONS,
  CHAT_INPUT_PARSEABLE_EXTENSIONS
} from '@/features/chat/lib/chat-constants'
import SendContentButton from './SendContentButton'
import {
  DragDropAttachment,
  DragDropImage,
  DragDropPlaceholder,
  DragDropTag
} from './extensions/drag-drop-file/DragDropFile.nodes'
import { DragDropFile } from './extensions/drag-drop-file/DragDropFile.plugin'
import type {
  DragDropEvent,
  EditorInserter,
  FileParser,
  UploadAdapter
} from './extensions/drag-drop-file/DragDropFile.types'
import { getFileExtension } from './extensions/drag-drop-file/DragDropFile.utils'
import { InputHistory } from './extensions/input-history/InputHistory.plugin'
import { SendContent } from './extensions/send-content/SendContent.plugin'
import {
  collectEditorContent,
  type SlashInputContent
} from './extensions/send-content/SendContent.utils'
import { SlashCommandNode } from './extensions/slash-command/SlashCommandNode'
import { SlashCommand } from './extensions/slash-command/SlashCommand.plugin'
import type { CommandItem } from './extensions/slash-command/SlashCommand.types'

export type { SlashInputContent } from './extensions/send-content/SendContent.utils'

const EDITOR_LINE_HEIGHT_PX = 24
const EDITOR_DEFAULT_LINES = 2
const EDITOR_VERTICAL_PADDING_PX = 20
const DEFAULT_EDITOR_MIN_HEIGHT_PX =
  EDITOR_LINE_HEIGHT_PX * EDITOR_DEFAULT_LINES + EDITOR_VERTICAL_PADDING_PX
const MAX_EDITOR_HEIGHT_PX = 350

interface SlashInputProps {
  width?: string
  height?: string
  slashItems?: CommandItem[]
  onSend?: (content: SlashInputContent) => void
  sendShortcuts?: string[]
  disabled?: boolean
  submitting?: boolean
  placeholder?: string
  ariaLabel?: string
  submitLabel?: string
  showSubmitText?: boolean
  showShortcutHint?: boolean
  shortcutHint?: string
  footerLeading?: ReactNode
  className?: string
}

export interface SlashInputRef {
  getContent: () => SlashInputContent | null
  clear: () => void
}

const MISMATCHED_TRANSACTION_ERROR_MESSAGE = 'Applying a mismatched transaction'

function createUploadAdapter(readImageErrorMessage: string): UploadAdapter {
  return {
    upload: async (file, onProgress) => {
      if (onProgress) {
        onProgress(0)
        await new Promise((resolve) => setTimeout(resolve, 120))
        onProgress(65)
        await new Promise((resolve) => setTimeout(resolve, 120))
        onProgress(100)
      }

      const url =
        file.type.startsWith('image/') && typeof FileReader !== 'undefined'
          ? await new Promise<string>((resolve, reject) => {
              const reader = new FileReader()
              reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '')
              reader.onerror = () => reject(reader.error ?? new Error(readImageErrorMessage))
              reader.readAsDataURL(file)
            })
          : URL.createObjectURL(file)

      return {
        url,
        metadata: {
          size: file.size,
          type: file.type
        }
      }
    }
  }
}

function createTextParser(): FileParser {
  return {
    supports: (file) => {
      const ext = getFileExtension(file)
      return CHAT_INPUT_PARSEABLE_EXTENSIONS.some((extension) => extension === ext)
    },
    parse: async (file) => {
      const content = await file.text()
      return { content }
    }
  }
}

function createNodeInserter(getEditor: () => Editor | null): EditorInserter {
  const findPlaceholderRange = (id: string): { from: number; to: number } | null => {
    const editor = getEditor()
    if (!editor) {
      return null
    }

    let range: { from: number; to: number } | null = null
    editor.state.doc.descendants((node, pos) => {
      if (node.type.name === 'dragDropPlaceholder' && node.attrs.id === id) {
        range = { from: pos, to: pos + node.nodeSize }
        return false
      }
      return true
    })
    return range
  }

  const insertAt = (payload: Content, at?: number): void => {
    const editor = getEditor()
    if (!editor) {
      return
    }

    if (typeof at === 'number') {
      editor.commands.insertContentAt(at, payload)
    } else {
      editor.commands.insertContent(payload)
    }
  }

  return {
    insertPlaceholder: (id, label) => {
      insertAt({
        type: 'dragDropPlaceholder',
        attrs: {
          id,
          label,
          status: 'queued',
          progress: 0
        }
      })
    },
    updatePlaceholder: (id, patch) => {
      const editor = getEditor()
      if (!editor) {
        return
      }

      const range = findPlaceholderRange(id)
      if (!range) {
        return
      }

      editor.commands.command(({ tr, state, dispatch }) => {
        let updated = false
        state.doc.nodesBetween(range.from, range.to, (node, pos) => {
          if (node.type.name !== 'dragDropPlaceholder' || node.attrs.id !== id) {
            return true
          }

          tr.setNodeMarkup(pos, undefined, {
            ...node.attrs,
            ...patch
          })
          updated = true
          return false
        })

        if (updated && dispatch) {
          dispatch(tr)
        }
        return updated
      })
    },
    replacePlaceholder: (id, payload) => {
      const editor = getEditor()
      if (!editor) {
        return
      }

      const range = findPlaceholderRange(id)
      if (payload.type === 'error') {
        if (range) {
          editor.commands.deleteRange(range)
        }
        return
      }

      let node: Content | null = null
      if (payload.type === 'image') {
        const relativePath =
          typeof payload.metadata?.relativePath === 'string' ? payload.metadata.relativePath : ''
        const absolutePath =
          typeof payload.metadata?.absolutePath === 'string' ? payload.metadata.absolutePath : ''
        node = {
          type: 'dragDropImage',
          attrs: {
            src: payload.url ?? '',
            alt: payload.fileName ?? '',
            title: payload.fileName ?? '',
            fileName: payload.fileName ?? '',
            relativePath,
            absolutePath,
            sequence: payload.sequence ?? null,
            sequenceType: payload.sequenceType ?? null
          }
        }
      } else if (payload.type === 'attachment') {
        node = {
          type: 'dragDropAttachment',
          attrs: {
            fileName: payload.fileName ?? ''
          }
        }
      } else if (payload.type === 'tag') {
        node = {
          type: 'dragDropTag',
          attrs: {
            label: payload.label ?? '',
            content: payload.content ?? '',
            metadata: payload.metadata ?? null,
            sequence: payload.sequence ?? null,
            sequenceType: payload.sequenceType ?? null
          }
        }
      }

      if (!node) {
        return
      }

      if (range) {
        editor.commands.insertContentAt(range, node)
      } else {
        editor.commands.insertContent(node)
      }
    },
    appendSpace: () => {
      insertAt(' ')
    }
  }
}

function hasSendableContent(content: SlashInputContent | null): boolean {
  if (!content) {
    return false
  }

  return (
    content.text.trim().length > 0 ||
    content.tags.length > 0 ||
    content.images.length > 0 ||
    content.attachments.length > 0
  )
}

function hasPendingUploadPlaceholder(content: SlashInputContent | null): boolean {
  if (!content?.raw) {
    return false
  }

  let found = false
  const walk = (node: JSONContent | null | undefined): void => {
    if (!node || found) {
      return
    }
    if (node.type === 'dragDropPlaceholder') {
      found = true
      return
    }
    if (Array.isArray(node.content)) {
      node.content.forEach((child) => walk(child))
    }
  }

  walk(content.raw)
  return found
}

const SlashInput = forwardRef<SlashInputRef, SlashInputProps>(function SlashInput(props, ref) {
  const { t } = useAppI18n()
  const {
    width,
    height,
    slashItems,
    onSend,
    sendShortcuts,
    disabled,
    submitting,
    placeholder,
    ariaLabel,
    submitLabel,
    showSubmitText,
    showShortcutHint,
    shortcutHint,
    footerLeading,
    className
  } = props

  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const editorStore = useMemo(() => ({ current: null as Editor | null }), [])
  const onSendRef = useRef(onSend)
  const disabledRef = useRef(Boolean(disabled))
  const submittingRef = useRef(Boolean(submitting))
  const [tagModal, setTagModal] = useState<{ label: string; content: string } | null>(null)
  const [imagePreviewModal, setImagePreviewModal] = useState<{
    src: string
    fileName: string
  } | null>(null)
  const [snapshot, setSnapshot] = useState<SlashInputContent | null>(null)

  const resolveSlashMenuAnchorRect = useCallback((): DOMRect | null => {
    return rootRef.current?.getBoundingClientRect() ?? null
  }, [])

  const slashExtension = useMemo(
    () =>
      slashItems
        ? SlashCommand.configure({
            items: slashItems,
            menuAnchorRect: resolveSlashMenuAnchorRect
          })
        : SlashCommand.configure({
            menuAnchorRect: resolveSlashMenuAnchorRect
          }),
    [resolveSlashMenuAnchorRect, slashItems, t]
  )

  const inserter = useMemo(() => createNodeInserter(() => editorStore.current), [editorStore])
  const uploadAdapter = useMemo(() => createUploadAdapter(t('chat.slash.readImageFailed')), [t])
  const parsers = useMemo(() => [createTextParser()], [])

  const handleTagClick = useCallback((attrs: { label?: string; content?: string }): void => {
    setTagModal({
      label: attrs.label ?? 'Tag',
      content: attrs.content ?? ''
    })
  }, [])

  const dragDropExtension = useMemo(
    () =>
      DragDropFile.configure({
        inserter,
        uploadAdapter,
        parsers,
        config: {
          parseableExtensions: [...CHAT_INPUT_PARSEABLE_EXTENSIONS],
          imageExtensions: [...CHAT_INPUT_IMAGE_EXTENSIONS],
          maxFileSizeMB: CHAT_INPUT_DRAG_DROP_CONFIG.maxFileSizeMB,
          maxFiles: CHAT_INPUT_DRAG_DROP_CONFIG.maxFiles,
          concurrentUploads: CHAT_INPUT_DRAG_DROP_CONFIG.concurrentUploads,
          insertTarget: { kind: 'editor' }
        },
        placeholderLabel: ({ file }) => file.name,
        onEvent: (event: DragDropEvent) => {
          if (event.type === 'file:error') {
            console.error('[DragDropFile]', event.error)
          }
        }
      }),
    [inserter, parsers, uploadAdapter]
  )

  const tagNodeExtension = useMemo(
    () => DragDropTag.configure({ onTagClick: handleTagClick }),
    [handleTagClick]
  )
  const imageNodeExtension = useMemo(
    () =>
      DragDropImage.configure({
        onImageClick: (attrs: { src?: string; fileName?: string; alt?: string }) => {
          const src = attrs.src?.trim()
          if (!src) {
            return
          }
          setImagePreviewModal({
            src,
            fileName: attrs.fileName?.trim() || attrs.alt?.trim() || t('chat.slash.imagePreview')
          })
        }
      }),
    [t]
  )

  const scheduleSafeClearContent = useCallback((targetEditor: Editor): void => {
    const runClear = (retryLeft: number): void => {
      if (targetEditor.isDestroyed) {
        return
      }

      try {
        targetEditor.commands.clearContent()
        setSnapshot(collectEditorContent(targetEditor))
      } catch (error) {
        if (
          retryLeft > 0 &&
          error instanceof RangeError &&
          error.message.includes(MISMATCHED_TRANSACTION_ERROR_MESSAGE)
        ) {
          queueMicrotask(() => runClear(retryLeft - 1))
          return
        }

        console.error('[SlashInput] clearContent failed', error)
      }
    }

    queueMicrotask(() => runClear(1))
  }, [])

  useEffect(() => {
    onSendRef.current = onSend
  }, [onSend])

  useEffect(() => {
    disabledRef.current = Boolean(disabled)
  }, [disabled])

  useEffect(() => {
    submittingRef.current = Boolean(submitting)
  }, [submitting])

  const sendExtension = useMemo(
    () =>
      SendContent.configure({
        getContent: (editor) => collectEditorContent(editor),
        onSend: (content, editor) => {
          const resolved = content as SlashInputContent
          if (
            !hasSendableContent(resolved) ||
            hasPendingUploadPlaceholder(resolved) ||
            disabledRef.current ||
            submittingRef.current
          ) {
            return
          }

          if (resolved.text.trim()) {
            const manager = (
              editor.storage as
                | {
                    inputHistory?: {
                      manager?: { push: (text: string) => void; resetIndex: () => void }
                    }
                  }
                | undefined
            )?.inputHistory?.manager
            manager?.push(resolved.text)
            manager?.resetIndex()
          }

          onSendRef.current?.(resolved)
          scheduleSafeClearContent(editor)
        },
        shortcuts: sendShortcuts
      }),
    [scheduleSafeClearContent, sendShortcuts]
  )

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder: placeholder ?? t('chat.slash.placeholder')
      }),
      slashExtension,
      InputHistory.configure({
        maxHistory: 30
      }),
      SlashCommandNode,
      DragDropPlaceholder,
      imageNodeExtension,
      DragDropAttachment,
      tagNodeExtension,
      dragDropExtension,
      sendExtension
    ],
    editorProps: {
      attributes: {
        'aria-label': ariaLabel ?? t('chat.slash.ariaInput'),
        class:
          'tiptap ProseMirror min-h-[48px] w-full outline-none text-[15px] leading-6 text-foreground [&_.is-editor-empty:first-child::before]:pointer-events-none [&_.is-editor-empty:first-child::before]:float-left [&_.is-editor-empty:first-child::before]:h-0 [&_.is-editor-empty:first-child::before]:text-[#A0A8B6] [&_.is-editor-empty:first-child::before]:content-[attr(data-placeholder)]'
      }
    },
    onUpdate: ({ editor: updated }) => {
      setSnapshot(collectEditorContent(updated))
    }
  }, [ariaLabel, dragDropExtension, imageNodeExtension, placeholder, sendExtension, slashExtension, t, tagNodeExtension])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/immutability
    editorStore.current = editor
    setSnapshot(collectEditorContent(editor))
  }, [editor, editorStore])

  useEffect(() => {
    if (!editor) {
      return
    }
    editor.setEditable(!(disabled || submitting))
  }, [disabled, editor, submitting])

  const openFilePicker = useCallback((): void => {
    fileInputRef.current?.click()
  }, [])

  const insertFiles = useCallback(
    (fileList: FileList | null): void => {
      if (!fileList || fileList.length === 0 || !editorStore.current) {
        return
      }
      editorStore.current.commands.insertFiles(Array.from(fileList))
    },
    [editorStore]
  )

  useImperativeHandle(
    ref,
    () => ({
      getContent: () => collectEditorContent(editorStore.current),
      clear: () => {
        editorStore.current?.commands.clearContent()
        setSnapshot(collectEditorContent(editorStore.current))
      }
    }),
    [editorStore]
  )

  const canSend =
    hasSendableContent(snapshot) &&
    !hasPendingUploadPlaceholder(snapshot) &&
    !(disabled || submitting)
  const normalizedShortcutHint = typeof shortcutHint === 'string' ? shortcutHint.trim() : ''
  const shouldRenderShortcutHint = showShortcutHint === true && normalizedShortcutHint.length > 0

  return (
    <div
      ref={rootRef}
      className={cn(
        'rounded-[1rem] border border-black/6 bg-white shadow-[0_10px_24px_-20px_rgba(15,23,42,0.18)] transition-colors duration-200 focus-within:border-[#0A84FF]/20',
        className
      )}
    >
      <div
        className="overflow-y-auto px-4 pt-3 pb-2"
        style={{
          minHeight: height ?? `${DEFAULT_EDITOR_MIN_HEIGHT_PX}px`,
          maxHeight: `${MAX_EDITOR_HEIGHT_PX}px`,
          width
        }}
      >
        <EditorContent editor={editor} />
      </div>

      <div className="flex items-center gap-2.5 border-t border-black/5 px-4 py-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <div className="flex min-w-0 items-center gap-2">
            {footerLeading ? <div className="min-w-0">{footerLeading}</div> : null}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={t('chat.slash.uploadFile')}
              onClick={openFilePicker}
              disabled={disabled || submitting}
              className="size-7 shrink-0 rounded-[0.65rem] text-[#627289] hover:bg-[#EEF3FA] hover:text-[#334155] disabled:bg-transparent"
            >
              <Paperclip className="size-3.5" />
            </Button>
          </div>

          {shouldRenderShortcutHint ? (
            <span className="ml-auto text-[11px] font-medium text-[#8B94A3]">
              {normalizedShortcutHint}
            </span>
          ) : null}
        </div>

        <SendContentButton
          editor={editor}
          label={showSubmitText === false ? '' : (submitLabel ?? t('chat.slash.send'))}
          showLabel={showSubmitText !== false}
          submitting={submitting}
          disabled={!canSend}
          aria-label={submitting ? t('chat.slash.sending') : (submitLabel ?? t('chat.slash.send'))}
          className="h-7 rounded-[0.75rem] border border-[#0A84FF]/10 bg-[#0A84FF] px-2.5 text-[12px] font-semibold text-white shadow-none transition-colors hover:bg-[#0077ED] disabled:border-[#C8D0DB] disabled:bg-[#D8DEE8] disabled:text-[#788394] disabled:opacity-100 disabled:hover:bg-[#D8DEE8]"
        />
      </div>

      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        multiple
        onChange={(event) => {
          insertFiles(event.target.files)
          event.currentTarget.value = ''
        }}
      />

      {tagModal ? (
        <DialogShell title={tagModal.label} onClose={() => setTagModal(null)}>
          <pre className="max-h-[50vh] overflow-y-auto rounded-[0.75rem] bg-[#F8FAFC] p-3 text-xs leading-6 text-foreground">
            {tagModal.content}
          </pre>
        </DialogShell>
      ) : null}

      {imagePreviewModal ? (
        <ImagePreviewOverlay
          src={imagePreviewModal.src}
          alt={imagePreviewModal.fileName}
          onClose={() => setImagePreviewModal(null)}
        />
      ) : null}
    </div>
  )
})

SlashInput.displayName = 'SlashInput'

export default SlashInput
