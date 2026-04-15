import { Extension } from '@tiptap/core'
import type { SendContentOptions } from './SendContent.types'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    sendContent: {
      sendContent: () => ReturnType
    }
  }
}

export const SendContent = Extension.create<SendContentOptions>({
  name: 'sendContent',
  addOptions() {
    return {
      getContent: undefined,
      onSend: undefined,
      shortcuts: ['Alt-Enter']
    }
  },
  addKeyboardShortcuts() {
    const shortcuts = (this.options.shortcuts || []).filter(Boolean)
    const unique = Array.from(new Set(shortcuts))
    return unique.reduce<Record<string, () => boolean>>((acc, shortcut) => {
      acc[shortcut] = () => this.editor.commands.sendContent()
      return acc
    }, {})
  },
  addCommands() {
    return {
      sendContent:
        () =>
        ({ editor }) => {
          const content = this.options.getContent?.(editor)
          if (content !== null && content !== undefined) {
            this.options.onSend?.(content, editor)
          }
          return true
        }
    }
  }
})
