export const GATEWAY_CHAT_POLL_INTERVAL_MS = {
  busy: 120,
  idle: 360
} as const

export const GATEWAY_EVENTS_MAX_EVENTS = 60
export const GATEWAY_EVENTS_DRAIN_MAX_ATTEMPTS = 4

export const GATEWAY_REQUEST_TIMEOUT_MS = {
  subscribe: 5_000,
  history: 15_000,
  sessionPatch: 12_000,
  chatSend: 20_000,
  sessionReset: 20_000
} as const

export const HOME_CHAT_SESSION_LIST_LIMIT = 120
export const HOME_CHAT_REQUEST_TIMEOUT_MS = {
  sessionPatch: 10_000,
  sessionsList: 15_000,
  sessionDelete: 10_000
} as const

export const CHAT_INPUT_PARSEABLE_EXTENSIONS = ['txt', 'md', 'json', 'js', 'ts', 'tsx'] as const
export const CHAT_INPUT_IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif', 'webp'] as const
export const CHAT_INPUT_DRAG_DROP_CONFIG = {
  maxFileSizeMB: 20,
  maxFiles: 10,
  concurrentUploads: 3
} as const
