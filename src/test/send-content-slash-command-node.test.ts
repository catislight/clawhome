import { describe, expect, it } from 'vitest'

import { collectEditorContent } from '../renderer/src/features/chat/components/editor/extensions/send-content/SendContent.utils'

function createEditorStub(json: Record<string, unknown>) {
  return {
    getJSON: () => json
  } as unknown as Parameters<typeof collectEditorContent>[0]
}

describe('collectEditorContent with slash command node', () => {
  it('serializes slash command node with filled args into command text', () => {
    const editor = createEditorStub({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'slashCommandNode',
              attrs: {
                command: '/skill',
                args: [
                  { key: 'name', label: '技能名' },
                  { key: 'input', label: '输入' }
                ],
                values: {
                  name: 'deploy',
                  input: 'release preview'
                }
              }
            }
          ]
        }
      ]
    })

    const content = collectEditorContent(editor)
    expect(content?.text).toBe('/skill deploy "release preview"')
  })
})
