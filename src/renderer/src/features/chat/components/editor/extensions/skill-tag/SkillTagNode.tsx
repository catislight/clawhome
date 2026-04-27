import { mergeAttributes, Node } from '@tiptap/core'
import { NodeViewWrapper, ReactNodeViewRenderer, type ReactNodeViewProps } from '@tiptap/react'
import { type CSSProperties, type JSX } from 'react'

type SkillTagNodeAttrs = {
  skillName?: string
}

const wrapperStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  height: '22px',
  maxWidth: '260px',
  border: '1px solid #E7CFA0',
  borderRadius: '9999px',
  background: '#FFF5E2',
  padding: '0 9px',
  margin: '0 4px',
  verticalAlign: 'middle'
}

const textStyle: CSSProperties = {
  display: 'inline-block',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  fontSize: '11px',
  lineHeight: '16px',
  fontWeight: 600,
  color: '#8B5D14'
}

function SkillTagNodeView({ node, selected }: ReactNodeViewProps): JSX.Element {
  const attrs = node.attrs as SkillTagNodeAttrs
  const skillName = typeof attrs.skillName === 'string' ? attrs.skillName.trim() : ''

  return (
    <NodeViewWrapper
      as="span"
      data-skill-tag-node="true"
      contentEditable={false}
      style={{
        ...wrapperStyle,
        boxShadow: selected ? '0 0 0 2px rgba(139,93,20,0.16)' : 'none'
      }}
    >
      <span style={textStyle} title={skillName}>
        {skillName || 'skill'}
      </span>
    </NodeViewWrapper>
  )
}

export const SkillTagNode = Node.create({
  name: 'skillTagNode',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,
  draggable: false,

  addAttributes() {
    return {
      skillName: { default: '' }
    }
  },

  parseHTML() {
    return [{ tag: 'span[data-skill-tag-node]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(HTMLAttributes, {
        'data-skill-tag-node': 'true',
        style:
          'display:inline-flex;align-items:center;height:22px;border:1px solid #E7CFA0;border-radius:9999px;background:#FFF5E2;padding:0 9px;font-size:11px;line-height:16px;font-weight:600;color:#8B5D14;'
      }),
      HTMLAttributes.skillName || 'skill'
    ]
  },

  addNodeView() {
    return ReactNodeViewRenderer(SkillTagNodeView)
  }
})
