import { mergeAttributes, Node } from '@tiptap/core'
import { NodeViewWrapper, type ReactNodeViewProps, ReactNodeViewRenderer } from '@tiptap/react'
import type { CSSProperties, JSX } from 'react'
import { useAppI18n } from '@/shared/i18n/app-i18n'

interface DragDropTagOptions {
  onTagClick?: (attrs: {
    label?: string
    content?: string
    metadata?: Record<string, unknown> | null
    sequence?: number | null
    sequenceType?: 'image' | 'attachment' | null
  }) => void
}

interface DragDropImageOptions {
  onImageClick?: (attrs: {
    src?: string
    fileName?: string
    alt?: string
    title?: string
    relativePath?: string
    absolutePath?: string
  }) => void
}

const badgeStyle: CSSProperties = {
  fontSize: '10px',
  fontWeight: 600,
  lineHeight: 1,
  color: '#334155',
  background: '#E2E8F0',
  borderRadius: '999px',
  padding: '3px 6px',
  textTransform: 'uppercase',
  letterSpacing: '0.02em'
}

const nodeWrapperStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px',
  padding: '4px 8px',
  margin: '0 5px',
  borderRadius: '8px',
  border: '1px solid #e2e8f0',
  background: '#fff',
  lineHeight: 1.2,
  minHeight: '28px',
  verticalAlign: 'middle'
}

function resolveNodeWrapperStyle(params: {
  selected: boolean
  interactive?: boolean
}): CSSProperties {
  return {
    ...nodeWrapperStyle,
    ...(params.interactive ? { cursor: 'pointer' } : {}),
    borderColor: params.selected ? '#0A84FF' : '#e2e8f0',
    boxShadow: params.selected ? '0 0 0 2px rgba(10,132,255,0.22)' : 'none',
    background: params.selected ? '#F8FBFF' : nodeWrapperStyle.background
  }
}

const TagNodeView = ({ node, extension, selected }: ReactNodeViewProps): JSX.Element => {
  const { t } = useAppI18n()
  const options = extension.options as DragDropTagOptions
  const { label, content, metadata, sequence, sequenceType } = node.attrs
  const prefix = sequenceType && sequence ? `[${sequenceType}#${sequence}] ` : ''

  return (
    <NodeViewWrapper
      as="span"
      data-dd-tag="true"
      data-drag-handle="true"
      draggable
      contentEditable={false}
      style={resolveNodeWrapperStyle({ selected, interactive: true })}
      onClick={() =>
        options.onTagClick?.({
          label,
          content,
          metadata,
          sequence,
          sequenceType
        })
      }
    >
      <span style={badgeStyle}>{t('chat.output.tagText')}</span>
      {prefix}
      {label || 'Tag'}
    </NodeViewWrapper>
  )
}

const ImageNodeView = ({ node, extension, selected }: ReactNodeViewProps): JSX.Element => {
  const { t } = useAppI18n()
  const options = extension.options as DragDropImageOptions
  const { src, alt, title, fileName, relativePath, absolutePath } = node.attrs

  return (
    <NodeViewWrapper
      as="span"
      data-dd-image="true"
      data-drag-handle="true"
      draggable
      contentEditable={false}
      style={resolveNodeWrapperStyle({ selected, interactive: true })}
      onClick={() =>
        options.onImageClick?.({
          src,
          fileName,
          alt,
          title,
          relativePath,
          absolutePath
        })
      }
    >
      <span style={badgeStyle}>{t('chat.output.tagImage')}</span>
      <span
        style={{
          fontSize: '12px',
          color: '#0f172a',
          whiteSpace: 'nowrap',
          maxWidth: '140px',
          overflow: 'hidden',
          textOverflow: 'ellipsis'
        }}
      >
        {fileName || t('chat.conversationInput.imageAttachment')}
      </span>
    </NodeViewWrapper>
  )
}

const AttachmentNodeView = ({ node, selected }: ReactNodeViewProps): JSX.Element => {
  const { t } = useAppI18n()
  const { fileName } = node.attrs

  return (
    <NodeViewWrapper
      as="span"
      data-dd-attachment="true"
      data-drag-handle="true"
      draggable
      contentEditable={false}
      style={resolveNodeWrapperStyle({ selected })}
    >
      <span style={badgeStyle}>{t('chat.output.tagAttachment')}</span>
      <span
        style={{
          fontSize: '12px',
          color: '#0f172a',
          whiteSpace: 'nowrap',
          maxWidth: '140px',
          overflow: 'hidden',
          textOverflow: 'ellipsis'
        }}
      >
        {fileName || t('chat.conversationInput.genericAttachment')}
      </span>
    </NodeViewWrapper>
  )
}

export const DragDropTag = Node.create<DragDropTagOptions>({
  name: 'dragDropTag',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,
  draggable: true,

  addOptions() {
    return {
      onTagClick: undefined
    }
  },

  addAttributes() {
    return {
      label: {
        default: ''
      },
      content: {
        default: ''
      },
      metadata: {
        default: null
      },
      sequence: {
        default: null,
        renderHTML: (attrs) => (attrs.sequence ? { 'data-sequence': attrs.sequence } : {})
      },
      sequenceType: {
        default: null,
        renderHTML: (attrs) =>
          attrs.sequenceType ? { 'data-sequence-type': attrs.sequenceType } : {}
      }
    }
  },

  parseHTML() {
    return [{ tag: 'span[data-dd-tag]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(HTMLAttributes, {
        'data-dd-tag': 'true',
        style:
          'display:inline-flex;align-items:center;gap:6px;padding:2px 6px;border-radius:6px;border:1px solid #e2e8f0;background:#f8fafc;font-size:12px;line-height:1.2;'
      }),
      HTMLAttributes.label || 'Tag'
    ]
  },

  addNodeView() {
    return ReactNodeViewRenderer(TagNodeView)
  }
})

export const DragDropPlaceholder = Node.create({
  name: 'dragDropPlaceholder',

  group: 'inline',
  inline: true,
  atom: true,
  selectable: false,

  addAttributes() {
    return {
      id: {
        default: ''
      },
      label: {
        default: ''
      },
      status: {
        default: 'queued'
      },
      progress: {
        default: 0
      },
      error: {
        default: ''
      }
    }
  },

  parseHTML() {
    return [{ tag: 'span[data-dd-placeholder]' }]
  },

  renderHTML({ HTMLAttributes }) {
    const status = HTMLAttributes.status ? ` ${HTMLAttributes.status}` : ''
    const progress =
      typeof HTMLAttributes.progress === 'number' ? ` ${HTMLAttributes.progress}%` : ''
    return [
      'span',
      mergeAttributes(HTMLAttributes, {
        'data-dd-placeholder': 'true',
        style:
          'display:inline-flex;align-items:center;gap:6px;border:1px dashed #cbd5f5;padding:2px 6px;border-radius:6px;background:#f8fafc;font-size:12px;color:#475569;line-height:1.2;'
      }),
      `${HTMLAttributes.label || 'Uploading'}${status}${progress}`
    ]
  }
})

export const DragDropImage = Node.create<DragDropImageOptions>({
  name: 'dragDropImage',

  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,
  draggable: true,

  addOptions() {
    return {
      onImageClick: undefined
    }
  },

  addAttributes() {
    return {
      src: { default: '' },
      alt: { default: '' },
      title: { default: '' },
      fileName: { default: '' },
      relativePath: { default: '' },
      absolutePath: { default: '' }
    }
  },

  parseHTML() {
    return [{ tag: 'span[data-dd-image]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(HTMLAttributes, {
        'data-dd-image': 'true',
        style:
          'display:inline-flex;align-items:center;gap:8px;padding:2px 6px;border:1px solid #e2e8f0;border-radius:8px;background:#fff;line-height:1.2;vertical-align:middle;'
      }),
      [
        'img',
        {
          src: HTMLAttributes.src,
          alt: HTMLAttributes.alt || HTMLAttributes.fileName || '',
          title: HTMLAttributes.title || HTMLAttributes.fileName || '',
          style:
            'width:48px;height:48px;object-fit:cover;border-radius:6px;display:block;flex:0 0 auto;'
        }
      ],
      [
        'span',
        {
          style:
            'font-size:12px;color:#64748b;white-space:nowrap;max-width:180px;overflow:hidden;text-overflow:ellipsis;'
        },
        `${HTMLAttributes.fileName || ''}`
      ]
    ]
  },

  addNodeView() {
    return ReactNodeViewRenderer(ImageNodeView)
  }
})

export const DragDropAttachment = Node.create({
  name: 'dragDropAttachment',

  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      fileName: { default: '' }
    }
  },

  parseHTML() {
    return [{ tag: 'span[data-dd-attachment]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(HTMLAttributes, {
        'data-dd-attachment': 'true',
        style:
          'display:inline-flex;align-items:center;gap:8px;padding:2px 6px;border:1px solid #e2e8f0;border-radius:8px;background:#fff;line-height:1.2;vertical-align:middle;'
      }),
      [
        'div',
        {
          style:
            'font-size:12px;color:#0f172a;white-space:nowrap;max-width:180px;overflow:hidden;text-overflow:ellipsis;'
        },
        `${HTMLAttributes.fileName || 'Attachment'}`
      ]
    ]
  },

  addNodeView() {
    return ReactNodeViewRenderer(AttachmentNodeView)
  }
})
