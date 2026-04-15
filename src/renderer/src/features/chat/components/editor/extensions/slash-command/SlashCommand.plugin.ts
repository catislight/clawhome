import { Extension, type Editor, type Range } from '@tiptap/core'
import { ReactRenderer } from '@tiptap/react'
import Suggestion, { type SuggestionOptions } from '@tiptap/suggestion'
import { translateWithAppLanguage } from '@/shared/i18n/app-i18n'
import SlashMenu, { type SlashMenuRef } from './SlashCommandMenu'
import { type CommandItem } from './SlashCommand.types'

type SlashCommandOptions = {
  items: CommandItem[]
  menuAnchorRect?: (() => DOMRect | null) | null
}

function createDefaultItems(): CommandItem[] {
  const helpDescription = translateWithAppLanguage('chat.slash.default.helpDescription')
  const statusDescription = translateWithAppLanguage('chat.slash.default.statusDescription')

  return [
    {
      title: '/help',
      description: helpDescription,
      keywords: ['help'],
      command: ({ editor, range }: { editor: Editor; range: Range }) =>
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .insertContent([
            {
              type: 'slashCommandNode',
              attrs: {
                command: '/help',
                description: helpDescription,
                args: [],
                values: {}
              }
            },
            { type: 'text', text: ' ' }
          ])
          .run()
    },
    {
      title: '/status',
      description: statusDescription,
      keywords: ['status'],
      command: ({ editor, range }: { editor: Editor; range: Range }) =>
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .insertContent([
            {
              type: 'slashCommandNode',
              attrs: {
                command: '/status',
                description: statusDescription,
                args: [],
                values: {}
              }
            },
            { type: 'text', text: ' ' }
          ])
          .run()
    }
  ]
}

const createSuggestion = (
  getItems: () => CommandItem[],
  getMenuAnchorRect: () => (() => DOMRect | null) | null | undefined
): Omit<SuggestionOptions<CommandItem>, 'editor'> => ({
  char: '/',
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

export const SlashCommand = Extension.create<SlashCommandOptions>({
  name: 'slash-command',
  addOptions() {
    return {
      items: createDefaultItems(),
      menuAnchorRect: null
    }
  },
  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        ...createSuggestion(
          () => this.options.items,
          () => this.options.menuAnchorRect
        )
      })
    ]
  }
})
