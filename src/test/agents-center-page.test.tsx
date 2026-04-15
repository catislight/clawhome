import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { SshConnectionFormValues } from '../renderer/src/features/instances/model/ssh-connection'
import AgentsCenterPage from '../renderer/src/features/agents/pages/agents-center-page'
import {
  createInitialAppStoreState,
  useAppStore
} from '../renderer/src/features/instances/store/use-app-store'

const mockConnectionConfig: SshConnectionFormValues = {
  title: 'root@prod',
  port: 22,
  host: '10.0.0.10',
  username: 'root',
  password: 'secret',
  privateKey: 'PRIVATE_KEY',
  privateKeyPassphrase: ''
}

const mockLocalConnectionConfig: SshConnectionFormValues = {
  ...mockConnectionConfig,
  connectionType: 'local'
}

function createConnectedInstance(): string {
  const instanceId = useAppStore.getState().createOpenClawInstance({
    name: '生产集群',
    description: '线上环境'
  })

  useAppStore.getState().saveConnectionConfig(instanceId, mockConnectionConfig)
  useAppStore.getState().setConnectionState(instanceId, 'connected', {
    lastConnectedAt: '2026-03-24T08:00:00.000Z',
    lastError: null
  })

  return instanceId
}

function createConnectedLocalInstance(): string {
  const instanceId = useAppStore.getState().createOpenClawInstance({
    name: '本地工作区',
    description: 'local'
  })

  useAppStore.getState().saveConnectionConfig(instanceId, mockLocalConnectionConfig)
  useAppStore.getState().setConnectionState(instanceId, 'connected', {
    lastConnectedAt: '2026-03-24T08:00:00.000Z',
    lastError: null
  })

  return instanceId
}

function createMockFileList(agentId: string): Array<{
  name: string
  path: string
  missing: boolean
}> {
  return [
    'AGENTS.md',
    'SOUL.md',
    'TOOLS.md',
    'IDENTITY.md',
    'USER.md',
    'HEARTBEAT.md',
    'MEMORY.md',
    'memory.md',
    'memory/2026-04-02.md',
    'memory/2026-04-03.md'
  ].map((name) => ({
    name,
    path: `/workspace/${agentId}/${name}`,
    missing: false
  }))
}

describe('AgentsCenterPage', () => {
  beforeEach(() => {
    window.localStorage.clear()
    useAppStore.setState(createInitialAppStoreState())
    vi.clearAllMocks()
  })

  it('shows empty state when no instances exist', () => {
    render(
      <MemoryRouter initialEntries={['/agents']}>
        <AgentsCenterPage />
      </MemoryRouter>
    )

    expect(screen.getByText('暂无实例，')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '去创建' })).toBeInTheDocument()
  })

  it('renders split workspace with sidebar and tabs', async () => {
    const instanceId = createConnectedInstance()
    const requestGatewayMock = vi.mocked(window.api.requestGateway)

    requestGatewayMock.mockImplementation(async ({ method, params }) => {
      if (method === 'agents.list') {
        return {
          success: true,
          message: 'mock agents',
          payload: {
            defaultId: 'main',
            mainKey: 'main',
            scope: 'global',
            agents: [
              { id: 'main', name: '主智能体', identity: { emoji: '🤖' } },
              { id: 'research', name: '研究助手', identity: { emoji: '🧠' } }
            ]
          }
        }
      }

      if (method === 'config.get') {
        return {
          success: true,
          message: 'mock config',
          payload: {
            hash: 'hash-1',
            config: {
              agents: {
                list: [
                  { id: 'main', name: '主智能体', default: true, model: 'openai/gpt-5.4' },
                  { id: 'research', name: '研究助手', model: 'openai/gpt-5.2' }
                ]
              }
            }
          }
        }
      }

      if (method === 'models.list') {
        return {
          success: true,
          message: 'mock models',
          payload: {
            models: [{ id: 'openai/gpt-5.4', name: 'GPT-5.4', provider: 'openai' }]
          }
        }
      }

      if (method === 'agents.files.list') {
        const agentId = (params as { agentId: string }).agentId
        return {
          success: true,
          message: 'mock files',
          payload: {
            agentId,
            workspace: `/workspace/${agentId}`,
            files: createMockFileList(agentId)
          }
        }
      }

      if (method === 'agents.files.get') {
        const { agentId, name } = params as { agentId: string; name: string }
        return {
          success: true,
          message: 'mock file content',
          payload: {
            agentId,
            workspace: `/workspace/${agentId}`,
            file: {
              name,
              path: `/workspace/${agentId}/${name}`,
              missing: false,
              content: `# ${agentId}/${name}\n`
            }
          }
        }
      }

      if (method === 'tools.catalog') {
        return {
          success: true,
          message: 'mock tools',
          payload: {
            agentId: (params as { agentId: string }).agentId,
            profiles: [{ id: 'full', label: 'full' }],
            groups: []
          }
        }
      }

      return { success: true, message: 'ok', payload: {} }
    })

    render(
      <MemoryRouter initialEntries={[`/agents?instanceId=${instanceId}`]}>
        <AgentsCenterPage />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /主智能体/ })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /研究助手/ })).toBeInTheDocument()
    })

    expect(screen.getByRole('tab', { name: '人设' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: '记忆' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: '工具' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: '技能' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: '设置' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '主智能体' })).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.getByRole('textbox')).toHaveValue('# main/AGENTS.md\n')
    })

    const sidebar = screen.getByText('智能体').closest('aside')
    expect(sidebar).not.toBeNull()

    fireEvent.click(within(sidebar as HTMLElement).getByRole('button', { name: /研究助手/ }))

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: '研究助手' })).toBeInTheDocument()
      expect(
        within(sidebar as HTMLElement).getByRole('button', { name: /研究助手/ })
      ).toHaveAttribute('aria-pressed', 'true')
      expect(screen.getByRole('textbox')).toHaveValue('# research/AGENTS.md\n')
    })

    fireEvent.click(screen.getByRole('tab', { name: '记忆' }))
    await waitFor(() => {
      expect(screen.getByRole('textbox')).toHaveValue('# research/MEMORY.md\n')
    })
    expect(screen.queryByRole('button', { name: '2026-04-03' })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'memory 文件夹' }))
    await waitFor(() => {
      expect(screen.getByRole('button', { name: '2026-04-03' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: '2026-04-02' })).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: '2026-04-03' }))
    await waitFor(() => {
      expect(screen.getByRole('textbox')).toHaveValue('# research/memory/2026-04-03.md\n')
    })
  })

  it('reads unsupported memory file from selected agent workspace via ssh fallback', async () => {
    createConnectedInstance()
    const requestGatewayMock = vi.mocked(window.api.requestGateway)
    const executeSshCommandMock = vi.mocked(window.api.executeSshCommand)

    executeSshCommandMock.mockImplementation(async ({ command }) => {
      if (command.includes('memory_dir="$workspace/memory"')) {
        return {
          success: true,
          message: 'list memory',
          stdout: '2026-03-24.md\n',
          stderr: '',
          code: 0
        }
      }

      if (command.includes('/workspace/agents/main/memory/2026-03-24.md')) {
        return {
          success: true,
          message: 'read via ssh',
          stdout: '# ssh memory/2026-03-24.md\n',
          stderr: '',
          code: 0
        }
      }

      return {
        success: true,
        message: 'mock ssh',
        stdout: '',
        stderr: '',
        code: 0
      }
    })

    requestGatewayMock.mockImplementation(async ({ method, params }) => {
      if (method === 'agents.list') {
        return {
          success: true,
          message: 'mock agents',
          payload: {
            defaultId: 'main',
            mainKey: 'main',
            scope: 'global',
            agents: [
              {
                id: 'main',
                name: '主智能体',
                workspace: '/workspace/agents/main'
              }
            ]
          }
        }
      }

      if (method === 'config.get') {
        return {
          success: true,
          message: 'mock config',
          payload: {
            hash: 'hash-1',
            config: {
              agents: {
                list: [{ id: 'main', name: '主智能体', default: true }]
              }
            }
          }
        }
      }

      if (method === 'models.list') {
        return {
          success: true,
          message: 'mock models',
          payload: {
            models: [{ id: 'openai/gpt-5.4', name: 'GPT-5.4', provider: 'openai' }]
          }
        }
      }

      if (method === 'agents.files.list') {
        return {
          success: true,
          message: 'mock files',
          payload: {
            agentId: 'main',
            workspace: '/workspace',
            files: [
              {
                name: 'MEMORY.md',
                path: '/workspace/MEMORY.md',
                missing: false
              },
              {
                name: 'memory/2026-03-24.md',
                path: '/workspace/memory/2026-03-24.md',
                missing: false
              }
            ]
          }
        }
      }

      if (method === 'agents.files.get') {
        const { name } = params as { name: string }
        if (name === 'memory/2026-03-24.md') {
          return {
            success: false,
            message: 'unsupported file "memory/2026-03-24.md"'
          }
        }

        return {
          success: true,
          message: 'mock file content',
          payload: {
            agentId: 'main',
            workspace: '/workspace',
            file: {
              name,
              path: `/workspace/${name}`,
              missing: false,
              content: `# main/${name}\n`
            }
          }
        }
      }

      if (method === 'tools.catalog') {
        return {
          success: true,
          message: 'mock tools',
          payload: {
            agentId: 'main',
            profiles: [{ id: 'full', label: 'full' }],
            groups: []
          }
        }
      }

      return { success: true, message: 'ok', payload: {} }
    })

    render(
      <MemoryRouter initialEntries={['/agents']}>
        <AgentsCenterPage />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /主智能体/ })).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('tab', { name: '记忆' }))

    await waitFor(() => {
      expect(screen.getByRole('textbox')).toHaveValue('# main/MEMORY.md\n')
    })

    fireEvent.click(screen.getByRole('button', { name: 'memory 文件夹' }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '2026-03-24' })).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: '2026-03-24' }))

    await waitFor(() => {
      expect(screen.getByRole('textbox')).toHaveValue('# ssh memory/2026-03-24.md\n')
    })

    const readCommands = executeSshCommandMock.mock.calls
      .map((call) => (call[0] as { command?: string }).command ?? '')
      .filter((command) => command.includes('if [ -f'))

    expect(
      readCommands.some((command) =>
        command.includes('/workspace/agents/main/memory/2026-03-24.md')
      )
    ).toBe(true)
    expect(
      readCommands.some((command) => command.includes('/workspace/memory/2026-03-24.md'))
    ).toBe(false)
  })

  it('reads and writes memory folder files via local node-fs bridge for local instances', async () => {
    createConnectedLocalInstance()
    const requestGatewayMock = vi.mocked(window.api.requestGateway)
    const listLocalMemoryFilesMock = vi.mocked(window.api.listLocalMemoryFiles)
    const readLocalMemoryFileMock = vi.mocked(window.api.readLocalMemoryFile)
    const writeLocalMemoryFileMock = vi.mocked(window.api.writeLocalMemoryFile)
    const deleteLocalMemoryFileMock = vi.mocked(window.api.deleteLocalMemoryFile)

    listLocalMemoryFilesMock.mockImplementation(async ({ workspacePath }) => {
      if (workspacePath === '/workspace') {
        return {
          success: true,
          message: 'mock local list',
          files: ['memory/2026-04-04.md']
        }
      }

      return {
        success: true,
        message: 'mock local list',
        files: []
      }
    })

    readLocalMemoryFileMock.mockImplementation(async ({ workspacePath, relativeFilePath }) => {
      if (workspacePath === '/workspace' && relativeFilePath === 'memory/2026-04-04.md') {
        return {
          success: true,
          message: 'mock local read',
          found: true,
          content: '# local memory\n'
        }
      }

      return {
        success: true,
        message: 'mock local read',
        found: false,
        content: ''
      }
    })

    writeLocalMemoryFileMock.mockResolvedValue({
      success: true,
      message: 'mock local write'
    })
    deleteLocalMemoryFileMock.mockResolvedValue({
      success: true,
      message: 'mock local delete',
      deleted: true
    })

    requestGatewayMock.mockImplementation(async ({ method, params }) => {
      if (method === 'agents.list') {
        return {
          success: true,
          message: 'mock agents',
          payload: {
            defaultId: 'main',
            mainKey: 'main',
            scope: 'global',
            agents: [
              {
                id: 'main',
                name: '主智能体',
                workspace: '/workspace/agents/main'
              }
            ]
          }
        }
      }

      if (method === 'config.get') {
        return {
          success: true,
          message: 'mock config',
          payload: {
            hash: 'hash-1',
            config: {
              agents: {
                list: [{ id: 'main', name: '主智能体', default: true }]
              }
            }
          }
        }
      }

      if (method === 'models.list') {
        return {
          success: true,
          message: 'mock models',
          payload: {
            models: [{ id: 'openai/gpt-5.4', name: 'GPT-5.4', provider: 'openai' }]
          }
        }
      }

      if (method === 'agents.files.list') {
        return {
          success: true,
          message: 'mock files',
          payload: {
            agentId: 'main',
            workspace: '/workspace',
            files: [
              {
                name: 'MEMORY.md',
                path: '/workspace/MEMORY.md',
                missing: false
              }
            ]
          }
        }
      }

      if (method === 'agents.files.get') {
        const { name } = params as { name: string }
        return {
          success: true,
          message: 'mock file content',
          payload: {
            agentId: 'main',
            workspace: '/workspace',
            file: {
              name,
              path: `/workspace/${name}`,
              missing: false,
              content: '# main/MEMORY.md\n'
            }
          }
        }
      }

      if (method === 'tools.catalog') {
        return {
          success: true,
          message: 'mock tools',
          payload: {
            agentId: 'main',
            profiles: [{ id: 'full', label: 'full' }],
            groups: []
          }
        }
      }

      return { success: true, message: 'ok', payload: {} }
    })

    render(
      <MemoryRouter initialEntries={['/agents']}>
        <AgentsCenterPage />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /主智能体/ })).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('tab', { name: '记忆' }))
    await waitFor(() => {
      expect(screen.getByRole('textbox')).toHaveValue('# main/MEMORY.md\n')
    })
    expect(screen.queryByRole('button', { name: '删除当前文件' })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'memory 文件夹' }))

    await waitFor(() => {
      expect(listLocalMemoryFilesMock).toHaveBeenCalledWith({
        workspacePath: '/workspace/agents/main'
      })
      expect(listLocalMemoryFilesMock).toHaveBeenCalledWith({
        workspacePath: '/workspace'
      })
      expect(screen.getByRole('button', { name: '2026-04-04' })).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: '2026-04-04' }))

    await waitFor(() => {
      expect(readLocalMemoryFileMock).toHaveBeenCalledWith({
        workspacePath: '/workspace',
        relativeFilePath: 'memory/2026-04-04.md'
      })
      expect(screen.getByRole('textbox')).toHaveValue('# local memory\n')
    })
    expect(screen.getByRole('button', { name: '删除当前文件' })).toBeInTheDocument()

    const textarea = screen.getByRole('textbox')
    fireEvent.change(textarea, {
      target: { value: '# updated local memory\n' }
    })
    fireEvent.click(screen.getByRole('button', { name: '保存' }))

    await waitFor(() => {
      expect(writeLocalMemoryFileMock).toHaveBeenCalledWith({
        workspacePath: '/workspace',
        relativeFilePath: 'memory/2026-04-04.md',
        content: '# updated local memory\n'
      })
    })

    fireEvent.click(screen.getByRole('button', { name: '删除当前文件' }))
    fireEvent.click(screen.getByRole('button', { name: '确认删除' }))

    await waitFor(() => {
      expect(deleteLocalMemoryFileMock).toHaveBeenCalledWith({
        workspacePath: '/workspace',
        relativeFilePath: 'memory/2026-04-04.md'
      })
    })
  })

  it('toggles tools and skills via config.set', async () => {
    createConnectedInstance()
    const requestGatewayMock = vi.mocked(window.api.requestGateway)

    let currentConfig: Record<string, unknown> = {
      agents: {
        list: [{ id: 'main', name: '主智能体', default: true }]
      },
      tools: {
        profile: 'full'
      }
    }

    requestGatewayMock.mockImplementation(async ({ method, params }) => {
      if (method === 'agents.list') {
        return {
          success: true,
          message: 'mock agents',
          payload: {
            defaultId: 'main',
            mainKey: 'main',
            scope: 'global',
            agents: [{ id: 'main', name: '主智能体' }]
          }
        }
      }

      if (method === 'config.get') {
        return {
          success: true,
          message: 'mock config',
          payload: {
            hash: 'hash-1',
            config: currentConfig
          }
        }
      }

      if (method === 'config.set') {
        const raw = (params as { raw?: string }).raw ?? '{}'
        currentConfig = JSON.parse(raw)
        return {
          success: true,
          message: 'mock config set',
          payload: {
            ok: true,
            path: '~/.openclaw/openclaw.json',
            config: currentConfig
          }
        }
      }

      if (method === 'models.list') {
        return {
          success: true,
          message: 'mock models',
          payload: {
            models: [{ id: 'openai/gpt-5.4', name: 'GPT-5.4', provider: 'openai' }]
          }
        }
      }

      if (method === 'agents.files.list') {
        return {
          success: true,
          message: 'mock files',
          payload: {
            agentId: 'main',
            workspace: '/workspace/main',
            files: createMockFileList('main')
          }
        }
      }

      if (method === 'agents.files.get') {
        const { name } = params as { agentId: string; name: string }
        return {
          success: true,
          message: 'mock file content',
          payload: {
            agentId: 'main',
            workspace: '/workspace/main',
            file: {
              name,
              path: `/workspace/main/${name}`,
              missing: false,
              content: `# ${name}\n`
            }
          }
        }
      }

      if (method === 'tools.catalog') {
        return {
          success: true,
          message: 'mock tools',
          payload: {
            agentId: 'main',
            profiles: [
              { id: 'minimal', label: 'minimal' },
              { id: 'full', label: 'full' }
            ],
            groups: [
              {
                id: 'core',
                label: 'Core',
                source: 'core',
                tools: [
                  {
                    id: 'read',
                    label: 'Read',
                    description: 'Read files',
                    source: 'core',
                    defaultProfiles: ['minimal', 'full']
                  }
                ]
              }
            ]
          }
        }
      }

      if (method === 'skills.status') {
        return {
          success: true,
          message: 'mock skills',
          payload: {
            workspaceDir: '/workspace/main',
            managedSkillsDir: '/workspace/main/skills',
            skills: [
              {
                name: 'openai-docs',
                description: 'Read official docs',
                source: 'workspace',
                filePath: '/workspace/main/skills/openai-docs/SKILL.md',
                baseDir: '/workspace/main/skills/openai-docs',
                skillKey: 'openai-docs',
                disabled: false,
                eligible: true
              }
            ]
          }
        }
      }

      return { success: true, message: 'ok', payload: {} }
    })

    render(
      <MemoryRouter initialEntries={['/agents']}>
        <AgentsCenterPage />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /主智能体/ })).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('tab', { name: '工具' }))
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'inherit' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'minimal' })).toBeInTheDocument()
      expect(screen.getByRole('heading', { name: 'Core' })).toBeInTheDocument()
      expect(screen.getByText('Read')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: 'minimal' }))
    await waitFor(() => {
      expect(currentConfig).toMatchObject({
        agents: {
          list: [{ id: 'main', tools: { profile: 'minimal' } }]
        }
      })
    })

    fireEvent.click(screen.getByRole('switch', { name: 'Read 开关' }))

    await waitFor(() => {
      expect(requestGatewayMock).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'config.set'
        })
      )
    })

    fireEvent.click(screen.getByRole('tab', { name: '技能' }))
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: '自定义技能' })).toBeInTheDocument()
      expect(screen.getByText('openai-docs')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('switch', { name: 'openai-docs 开关' }))

    await waitFor(() => {
      const configSetCalls = requestGatewayMock.mock.calls.filter(
        (call) => call[0]?.method === 'config.set'
      )
      expect(configSetCalls.length).toBeGreaterThanOrEqual(2)
    })
  })
})
