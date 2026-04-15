import { Editor, type Range } from '@tiptap/core'

export interface CommandItemArg {
  key: string
  label: string
  placeholder?: string
  required?: boolean
}

export interface CommandItem {
  title: string
  description?: string
  keywords?: string[]
  args?: CommandItemArg[]
  command: (props: { editor: Editor; range: Range }) => void
}

export interface SlashMenuProps {
  items: CommandItem[]
  command: (item: CommandItem) => void
  clientRect?: (() => DOMRect | null) | null
  anchorRect?: (() => DOMRect | null) | null
}
