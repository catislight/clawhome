import type { Editor } from '@tiptap/core'

export interface SendContentOptions {
  getContent?: (editor: Editor) => unknown | null
  onSend?: (content: unknown, editor: Editor) => void
  shortcuts?: string[]
}
