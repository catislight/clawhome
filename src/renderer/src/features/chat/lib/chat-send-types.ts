export type ChatSubmitImage = {
  src: string
  fileName?: string
  relativePath?: string
  absolutePath?: string
}

export type ChatSubmitTag = {
  type: 'image' | 'attachment' | 'text'
  label: string
  previewSrc?: string
  relativePath?: string
  absolutePath?: string
}

export type ChatSubmitPayload = {
  message: string
  images: ChatSubmitImage[]
  tags: ChatSubmitTag[]
}
