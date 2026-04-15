import { Extension } from '@tiptap/core'
import { Plugin } from '@tiptap/pm/state'
import type { EditorView } from '@tiptap/pm/view'
import { HistoryManager } from './HistoryManager'

export interface InputHistoryOptions {
  maxHistory: number
}

export const InputHistory = Extension.create<InputHistoryOptions>({
  name: 'inputHistory',

  addOptions() {
    return {
      maxHistory: 50
    }
  },

  addStorage() {
    return {
      manager: new HistoryManager(this.options.maxHistory)
    }
  },

  addProseMirrorPlugins() {
    const { manager } = this.storage

    return [
      new Plugin({
        props: {
          handleKeyDown: (_view: EditorView, event: KeyboardEvent) => {
            const isCtrl = event.ctrlKey || event.metaKey

            if (isCtrl && event.key === 'ArrowUp') {
              const prevText = manager.getPrevious()
              if (prevText !== null) {
                this.editor.commands.setContent(prevText, { emitUpdate: false })
                return true
              }
            }

            if (isCtrl && event.key === 'ArrowDown') {
              const nextText = manager.getNext()
              if (nextText !== null) {
                this.editor.commands.setContent(nextText, { emitUpdate: false })
                return true
              }
            }

            if (isCtrl && event.key === 'Enter' && !event.shiftKey) {
              const currentContent = this.editor.getText()
              manager.push(currentContent)
              manager.resetIndex()
            }

            return false
          }
        }
      })
    ]
  },

  onUpdate() {
    const { manager } = this.storage as { manager: HistoryManager }
    const text = this.editor.getText().trim()
    if (!text) {
      manager.resetIndex()
    }
  }
})
