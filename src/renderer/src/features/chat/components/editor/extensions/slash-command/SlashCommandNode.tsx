import { mergeAttributes, Node } from '@tiptap/core'
import { NodeViewWrapper, type ReactNodeViewProps, ReactNodeViewRenderer } from '@tiptap/react'
import { type CSSProperties, type JSX } from 'react'

import type { CommandItemArg } from './SlashCommand.types'

type SlashCommandNodeAttrs = {
  command: string
  description?: string
  args?: CommandItemArg[]
  values?: Record<string, string>
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function normalizeArgs(value: unknown): CommandItemArg[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .filter((item): item is CommandItemArg => {
      return (
        isRecord(item) &&
        typeof item.key === 'string' &&
        item.key.trim().length > 0 &&
        typeof item.label === 'string' &&
        item.label.trim().length > 0
      )
    })
    .map((item) => ({
      key: item.key.trim(),
      label: item.label.trim(),
      placeholder: typeof item.placeholder === 'string' ? item.placeholder : undefined,
      required: Boolean(item.required)
    }))
}

function normalizeValues(value: unknown): Record<string, string> {
  if (!isRecord(value)) {
    return {}
  }

  const result: Record<string, string> = {}
  Object.entries(value).forEach(([key, entry]) => {
    if (typeof entry !== 'string') {
      return
    }
    result[key] = entry
  })
  return result
}

const wrapperStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '8px',
  minHeight: '30px',
  maxWidth: '100%',
  border: '1px solid #D7DFEB',
  borderRadius: '10px',
  background: '#F8FBFF',
  padding: '3px 8px',
  margin: '0 4px',
  verticalAlign: 'middle'
}

const commandStyle: CSSProperties = {
  fontSize: '12px',
  lineHeight: '18px',
  fontWeight: 600,
  color: '#0B63F6',
  whiteSpace: 'nowrap'
}

const inputStyle: CSSProperties = {
  minWidth: '72px',
  maxWidth: '140px',
  border: '1px solid #CFD8E7',
  borderRadius: '8px',
  padding: '2px 6px',
  fontSize: '11px',
  lineHeight: '16px',
  color: '#1F2937',
  background: '#FFFFFF',
  outline: 'none'
}

function SlashCommandNodeView({ node, updateAttributes, selected }: ReactNodeViewProps): JSX.Element {
  const attrs = node.attrs as SlashCommandNodeAttrs
  const command = typeof attrs.command === 'string' ? attrs.command.trim() : ''
  const args = normalizeArgs(attrs.args)
  const values = normalizeValues(attrs.values)

  return (
    <NodeViewWrapper
      as="span"
      data-slash-command-node="true"
      contentEditable={false}
      style={{
        ...wrapperStyle,
        borderColor: selected ? '#0A84FF' : '#D7DFEB',
        boxShadow: selected ? '0 0 0 2px rgba(10,132,255,0.16)' : 'none'
      }}
    >
      <span style={commandStyle}>{command || '/command'}</span>
      {args.map((arg) => (
        <input
          key={arg.key}
          value={values[arg.key] ?? ''}
          placeholder={arg.placeholder || arg.label}
          style={inputStyle}
          onMouseDown={(event) => event.stopPropagation()}
          onKeyDown={(event) => event.stopPropagation()}
          onChange={(event) => {
            const nextValues = {
              ...values,
              [arg.key]: event.currentTarget.value
            }
            updateAttributes({ values: nextValues })
          }}
        />
      ))}
    </NodeViewWrapper>
  )
}

export const SlashCommandNode = Node.create({
  name: 'slashCommandNode',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,
  draggable: false,

  addAttributes() {
    return {
      command: { default: '' },
      description: { default: '' },
      args: { default: [] },
      values: { default: {} }
    }
  },

  parseHTML() {
    return [{ tag: 'span[data-slash-command-node]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(HTMLAttributes, {
        'data-slash-command-node': 'true',
        style:
          'display:inline-flex;align-items:center;border:1px solid #D7DFEB;border-radius:10px;background:#F8FBFF;padding:2px 8px;font-size:12px;line-height:18px;'
      }),
      HTMLAttributes.command || '/command'
    ]
  },

  addNodeView() {
    return ReactNodeViewRenderer(SlashCommandNodeView)
  }
})
