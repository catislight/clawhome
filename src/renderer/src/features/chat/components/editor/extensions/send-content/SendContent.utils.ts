import type { Editor, JSONContent } from '@tiptap/core'
import type { CommandItemArg } from '../slash-command/SlashCommand.types'

export interface SlashInputContent {
  raw: JSONContent
  text: string
  images: Array<{
    src: string
    fileName?: string
    relativePath?: string
    absolutePath?: string
    sequence?: number | null
    sequenceType?: 'image' | 'attachment' | null
  }>
  attachments: Array<{
    fileName?: string
    sequence?: number | null
    sequenceType?: 'image' | 'attachment' | null
  }>
  tags: Array<{
    label?: string
    content?: string
    metadata?: Record<string, unknown> | null
    sequence?: number | null
    sequenceType?: 'image' | 'attachment' | null
  }>
}

export const collectEditorContent = (editor: Editor | null): SlashInputContent | null => {
  if (!editor) {
    return null
  }

  const raw = editor.getJSON()
  const result: SlashInputContent = {
    raw,
    text: '',
    images: [],
    attachments: [],
    tags: []
  }

  const blockTypes = new Set(['paragraph', 'heading', 'blockquote', 'codeBlock', 'listItem'])
  let pendingInlineSpace = false

  const ensureSpace = (): void => {
    const lastChar = result.text.slice(-1)
    if (!lastChar || /\s/.test(lastChar)) {
      return
    }
    result.text += ' '
  }

  const appendText = (text: string): void => {
    if (!text) {
      return
    }
    if (pendingInlineSpace && !/^\s/.test(text)) {
      ensureSpace()
    }
    pendingInlineSpace = false
    result.text += text
  }

  const appendInlineToken = (token?: string): void => {
    if (token && token.trim()) {
      ensureSpace()
      result.text += token.trim()
    }
    pendingInlineSpace = true
  }

  const quoteWhenNeeded = (value: string): string => {
    const trimmed = value.trim()
    if (!trimmed) {
      return ''
    }
    if (!/\s/.test(trimmed)) {
      return trimmed
    }
    if (
      (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
      (trimmed.startsWith("'") && trimmed.endsWith("'"))
    ) {
      return trimmed
    }
    return `"${trimmed.replaceAll('"', '\\"')}"`
  }

  const resolveSlashCommandText = (node: JSONContent): string => {
    const command = typeof node.attrs?.command === 'string' ? node.attrs.command.trim() : ''
    if (!command) {
      return ''
    }

    const args = Array.isArray(node.attrs?.args) ? (node.attrs?.args as CommandItemArg[]) : []
    const values = node.attrs?.values
    const valuesRecord =
      typeof values === 'object' && values !== null ? (values as Record<string, unknown>) : {}

    const serializedArgs: string[] = []
    args.forEach((arg) => {
      const rawValue = valuesRecord[arg.key]
      if (typeof rawValue !== 'string') {
        return
      }
      const normalized = quoteWhenNeeded(rawValue)
      if (!normalized) {
        return
      }
      serializedArgs.push(normalized)
    })

    return serializedArgs.length > 0 ? `${command} ${serializedArgs.join(' ')}` : command
  }

  const walk = (node: JSONContent): void => {
    if (!node) {
      return
    }

    if (node.type === 'text' && typeof node.text === 'string') {
      appendText(node.text)
    }

    if (node.type === 'dragDropImage') {
      result.images.push({
        src: node.attrs?.src ?? '',
        fileName: node.attrs?.fileName ?? '',
        relativePath: node.attrs?.relativePath ?? '',
        absolutePath: node.attrs?.absolutePath ?? '',
        sequence: node.attrs?.sequence ?? null,
        sequenceType: node.attrs?.sequenceType ?? null
      })
    }

    if (node.type === 'dragDropAttachment') {
      result.attachments.push({
        fileName: node.attrs?.fileName ?? '',
        sequence: node.attrs?.sequence ?? null,
        sequenceType: node.attrs?.sequenceType ?? null
      })
    }

    if (node.type === 'dragDropTag') {
      const prefix =
        node.attrs?.sequenceType && node.attrs?.sequence
          ? `[${node.attrs.sequenceType}#${node.attrs.sequence}] `
          : ''
      appendInlineToken(`${prefix}${node.attrs?.label || 'Tag'}`)
      result.tags.push({
        label: node.attrs?.label ?? '',
        content: node.attrs?.content ?? '',
        metadata: node.attrs?.metadata ?? null,
        sequence: node.attrs?.sequence ?? null,
        sequenceType: node.attrs?.sequenceType ?? null
      })
    }

    if (node.type === 'slashCommandNode') {
      appendInlineToken(resolveSlashCommandText(node))
    }

    if (Array.isArray(node.content)) {
      node.content.forEach((child) => walk(child))
      if (node.type && blockTypes.has(node.type)) {
        if (result.text && !result.text.endsWith('\n')) {
          result.text += '\n'
        }
        pendingInlineSpace = false
      }
    }
  }

  walk(raw)
  result.text = result.text.trim()
  return result
}
