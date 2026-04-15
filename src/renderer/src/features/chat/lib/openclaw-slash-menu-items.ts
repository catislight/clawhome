import type { Editor, Range } from '@tiptap/core'

import type {
  CommandItem,
  CommandItemArg
} from '@/features/chat/components/editor/extensions/slash-command/SlashCommand.types'

type OpenClawSlashPreset = {
  command: `/${string}`
  description: string
  aliases?: Array<`/${string}`>
  args?: CommandItemArg[]
  defaults?: Record<string, string>
}

const OPENCLAW_SLASH_COMMAND_PRESETS: OpenClawSlashPreset[] = [
  { command: '/help', description: '命令帮助' },
  { command: '/commands', description: '命令列表' },
  { command: '/status', description: '当前状态' },
  { command: '/whoami', aliases: ['/id'], description: '发送者身份' },
  {
    command: '/context',
    description: '上下文详情',
    args: [{ key: 'mode', label: '模式', placeholder: 'list|detail|json' }],
    defaults: { mode: 'detail' }
  },
  {
    command: '/model',
    description: '切换模型',
    args: [{ key: 'model', label: '模型', placeholder: 'provider/model' }]
  },
  { command: '/models', description: '可用模型' },
  {
    command: '/think',
    aliases: ['/thinking', '/t'],
    description: '思考强度',
    args: [{ key: 'level', label: '等级', placeholder: 'off|minimal|low|medium|high|xhigh' }],
    defaults: { level: 'medium' }
  },
  {
    command: '/verbose',
    aliases: ['/v'],
    description: '详细输出',
    args: [{ key: 'mode', label: '模式', placeholder: 'on|off|full' }],
    defaults: { mode: 'on' }
  },
  {
    command: '/reasoning',
    aliases: ['/reason'],
    description: '推理展示',
    args: [{ key: 'mode', label: '模式', placeholder: 'on|off|stream' }],
    defaults: { mode: 'on' }
  },
  {
    command: '/elevated',
    aliases: ['/elev'],
    description: '执行权限',
    args: [{ key: 'mode', label: '模式', placeholder: 'on|off|ask|full' }],
    defaults: { mode: 'ask' }
  },
  {
    command: '/exec',
    description: '执行策略',
    args: [
      { key: 'host', label: 'host', placeholder: 'sandbox|gateway|node' },
      { key: 'security', label: 'security', placeholder: 'deny|allowlist|full' },
      { key: 'ask', label: 'ask', placeholder: 'off|on-miss|always' },
      { key: 'node', label: 'node', placeholder: '节点ID(可选)' }
    ]
  },
  {
    command: '/queue',
    description: '队列模式',
    args: [
      { key: 'mode', label: '模式', placeholder: 'steer|interrupt|followup|collect' },
      { key: 'opts', label: '选项', placeholder: 'debounce:2s cap:25 drop:old' }
    ],
    defaults: { mode: 'steer' }
  },
  {
    command: '/usage',
    description: '用量显示',
    args: [{ key: 'mode', label: '模式', placeholder: 'off|tokens|full|cost' }],
    defaults: { mode: 'tokens' }
  },
  {
    command: '/new',
    description: '新建会话',
    args: [{ key: 'model', label: '模型', placeholder: '可选: provider/model' }]
  },
  { command: '/reset', description: '重置会话' },
  {
    command: '/compact',
    description: '压缩上下文',
    args: [{ key: 'instructions', label: '说明', placeholder: '可选压缩指令' }]
  },
  {
    command: '/session',
    description: '会话规则',
    args: [
      { key: 'action', label: '动作', placeholder: 'idle|max-age' },
      { key: 'value', label: '值', placeholder: 'off|24h|90m' }
    ],
    defaults: { action: 'idle', value: 'off' }
  },
  {
    command: '/subagents',
    description: '子代理管理',
    args: [
      { key: 'action', label: '动作', placeholder: 'list|kill|log|info|send|steer|spawn' },
      { key: 'target', label: '目标', placeholder: 'id/#/session(可选)' },
      { key: 'value', label: '内容', placeholder: '消息/参数(可选)' }
    ],
    defaults: { action: 'list' }
  },
  { command: '/agents', description: '会话智能体' },
  {
    command: '/acp',
    description: 'ACP 管理',
    args: [
      {
        key: 'action',
        label: '动作',
        placeholder:
          'status|sessions|spawn|cancel|steer|close|set-mode|set|cwd|permissions|timeout|model'
      },
      { key: 'value', label: '参数', placeholder: '动作参数(可选)' }
    ],
    defaults: { action: 'status' }
  },
  {
    command: '/allowlist',
    description: '白名单',
    args: [
      { key: 'action', label: '动作', placeholder: 'list|add|remove' },
      { key: 'target', label: '目标', placeholder: 'provider:id(可选)' }
    ],
    defaults: { action: 'list' }
  },
  {
    command: '/export-session',
    aliases: ['/export'],
    description: '导出会话',
    args: [{ key: 'path', label: '路径', placeholder: '可选导出路径' }]
  },
  {
    command: '/tts',
    description: '语音设置',
    args: [
      { key: 'action', label: '动作', placeholder: 'on|off|status|provider|limit|summary|audio' },
      { key: 'value', label: '值', placeholder: '参数(可选)' }
    ],
    defaults: { action: 'status' }
  },
  {
    command: '/focus',
    description: '聚焦目标',
    args: [{ key: 'target', label: '目标', placeholder: 'thread/session/subagent' }]
  },
  { command: '/unfocus', description: '取消聚焦' },
  {
    command: '/kill',
    description: '终止子代理',
    args: [{ key: 'target', label: '目标', placeholder: 'id|#|all' }]
  },
  {
    command: '/steer',
    aliases: ['/tell'],
    description: '转向子代理',
    args: [
      { key: 'target', label: '目标', placeholder: 'id|#' },
      { key: 'message', label: '消息', placeholder: '转向消息' }
    ]
  },
  {
    command: '/config',
    description: '配置修改',
    args: [
      { key: 'action', label: '动作', placeholder: 'show|get|set|unset' },
      { key: 'path', label: '路径', placeholder: 'config.path' },
      { key: 'value', label: '值', placeholder: 'set 时填写' }
    ]
  },
  {
    command: '/debug',
    description: '调试覆盖',
    args: [
      { key: 'action', label: '动作', placeholder: 'show|set|unset|reset' },
      { key: 'path', label: '路径', placeholder: 'debug.path' },
      { key: 'value', label: '值', placeholder: 'set 时填写' }
    ]
  },
  {
    command: '/skill',
    description: '执行技能',
    args: [
      { key: 'name', label: '技能名', placeholder: 'skill-name', required: true },
      { key: 'input', label: '输入', placeholder: '可选输入' }
    ]
  },
  {
    command: '/approve',
    description: '处理审批',
    args: [
      { key: 'id', label: '审批ID', placeholder: 'request-id', required: true },
      { key: 'action', label: '动作', placeholder: 'allow-once|allow-always|deny', required: true }
    ]
  },
  { command: '/stop', description: '停止运行' },
  { command: '/restart', description: '重启服务' },
  {
    command: '/activation',
    description: '激活模式',
    args: [{ key: 'mode', label: '模式', placeholder: 'mention|always' }]
  },
  {
    command: '/send',
    description: '发送策略',
    args: [{ key: 'mode', label: '模式', placeholder: 'on|off|inherit' }]
  },
  {
    command: '/dock-telegram',
    aliases: ['/dock_telegram'],
    description: '切到 Telegram'
  },
  {
    command: '/dock-discord',
    aliases: ['/dock_discord'],
    description: '切到 Discord'
  },
  { command: '/dock-slack', aliases: ['/dock_slack'], description: '切到 Slack' },
  {
    command: '/bash',
    description: '主机命令',
    args: [{ key: 'command', label: '命令', placeholder: '例如: ls -la', required: true }]
  }
]

function buildKeywords(preset: OpenClawSlashPreset): string[] {
  const normalizedCommand = preset.command.replace(/^\//, '')
  const aliasNames = (preset.aliases ?? []).map((alias) => alias.replace(/^\//, ''))

  const argNames = (preset.args ?? []).map((arg) => arg.key.toLowerCase())
  return [normalizedCommand, ...aliasNames, ...argNames]
}

function buildInitialArgValues(preset: OpenClawSlashPreset): Record<string, string> {
  if (!preset.args?.length) {
    return {}
  }

  const values: Record<string, string> = {}
  preset.args.forEach((arg) => {
    const defaultValue = preset.defaults?.[arg.key]
    values[arg.key] = typeof defaultValue === 'string' ? defaultValue : ''
  })
  return values
}

function insertSlashCommandNode(editor: Editor, range: Range, preset: OpenClawSlashPreset): void {
  const command = preset.command.trim()
  if (!command) {
    return
  }

  editor
    .chain()
    .focus()
    .deleteRange(range)
    .insertContent([
      {
        type: 'slashCommandNode',
        attrs: {
          command,
          description: preset.description,
          args: preset.args ?? [],
          values: buildInitialArgValues(preset)
        }
      },
      { type: 'text', text: ' ' }
    ])
    .run()
}

export const OPENCLAW_SLASH_MENU_ITEMS: CommandItem[] = OPENCLAW_SLASH_COMMAND_PRESETS.map(
  (preset) => ({
    title: preset.command,
    description: preset.description,
    keywords: buildKeywords(preset),
    args: preset.args,
    command: ({ editor, range }) => {
      insertSlashCommandNode(editor, range, preset)
    }
  })
)
