import { Extension, type Editor, type Range } from '@tiptap/core'
import { PluginKey } from '@tiptap/pm/state'
import { ReactRenderer } from '@tiptap/react'
import Suggestion, { type SuggestionOptions } from '@tiptap/suggestion'

import SlashMenu, {
  type SlashMenuRef
} from '@/features/chat/components/editor/extensions/slash-command/SlashCommandMenu'
import type { CommandItem } from '@/features/chat/components/editor/extensions/slash-command/SlashCommand.types'

type SkillTagSuggestionOptions = {
  skillNames: string[]
  menuAnchorRect?: (() => DOMRect | null) | null
  onMenuOpen?: (() => void) | null
  triggerChar: string
}

const SKILL_TAG_SUGGESTION_PLUGIN_KEY = new PluginKey('skill-tag-suggestion')

function normalizeSkillNames(input: string[]): string[] {
  const seen = new Set<string>()

  return input.flatMap((value) => {
    const normalized = value.trim()
    if (!normalized) {
      return []
    }

    const key = normalized.toLowerCase()
    if (seen.has(key)) {
      return []
    }
    seen.add(key)
    return [normalized]
  })
}

function insertSkillTagNode(editor: Editor, range: Range, skillName: string): void {
  editor
    .chain()
    .focus()
    .deleteRange(range)
    .insertContent([
      {
        type: 'skillTagNode',
        attrs: {
          skillName
        }
      },
      { type: 'text', text: ' ' }
    ])
    .run()
}

function buildSkillMenuItems(skillNames: string[]): CommandItem[] {
  return normalizeSkillNames(skillNames).map((skillName) => ({
    title: skillName,
    description: '/skill',
    keywords: [skillName, 'skill'],
    command: ({ editor, range }: { editor: Editor; range: Range }) => {
      insertSkillTagNode(editor, range, skillName)
    }
  }))
}

const createSuggestion = (
  getItems: () => CommandItem[],
  getMenuAnchorRect: () => (() => DOMRect | null) | null | undefined,
  getOnMenuOpen: () => (() => void) | null | undefined,
  getTriggerChar: () => string
): Omit<SuggestionOptions<CommandItem>, 'editor'> => ({
  pluginKey: SKILL_TAG_SUGGESTION_PLUGIN_KEY,
  char: getTriggerChar(),
  startOfLine: false,
  items: ({ query }) => {
    const normalizedQuery = query.trim().toLowerCase()
    if (!normalizedQuery) {
      return getItems()
    }

    return getItems().filter((item) => {
      const searchTargets = [item.title, item.description ?? '', ...(item.keywords ?? [])]
      return searchTargets.some((target) => target.toLowerCase().includes(normalizedQuery))
    })
  },
  command: ({ editor, range, props }) => {
    props.command({ editor, range })
  },
  render: () => {
    let component: ReactRenderer<SlashMenuRef> | null = null

    return {
      onStart: (props) => {
        getOnMenuOpen()?.()
        component = new ReactRenderer(SlashMenu, {
          props: {
            items: props.items,
            command: props.command,
            clientRect: props.clientRect,
            anchorRect: getMenuAnchorRect() ?? null
          },
          editor: props.editor
        })

        if (component.element.parentNode == null) {
          document.body.appendChild(component.element)
        }
      },
      onUpdate(props) {
        component?.updateProps({
          items: props.items,
          command: props.command,
          clientRect: props.clientRect,
          anchorRect: getMenuAnchorRect() ?? null
        })
      },
      onKeyDown(props) {
        if (props.event.key === 'Escape') {
          return true
        }
        return component?.ref?.onKeyDown(props) || false
      },
      onExit() {
        if (component?.element && component.element.parentNode) {
          component.element.parentNode.removeChild(component.element)
        }
        component?.destroy()
      }
    }
  }
})

export const SkillTagSuggestion = Extension.create<SkillTagSuggestionOptions>({
  name: 'skill-tag-suggestion',
  addOptions() {
    return {
      skillNames: [],
      menuAnchorRect: null,
      onMenuOpen: null,
      triggerChar: '$'
    }
  },
  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        ...createSuggestion(
          () => buildSkillMenuItems(this.options.skillNames),
          () => this.options.menuAnchorRect,
          () => this.options.onMenuOpen,
          () => this.options.triggerChar
        )
      })
    ]
  }
})
