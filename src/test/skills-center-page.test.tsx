import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { SshConnectionFormValues } from '../renderer/src/features/instances/model/ssh-connection'
import SkillsCenterPage from '../renderer/src/features/skills/pages/skills-center-page'
import { createInitialAppStoreState, useAppStore } from '../renderer/src/features/instances/store/use-app-store'

const mockConnectionConfig: SshConnectionFormValues = {
  title: 'root@prod',
  port: 22,
  host: '10.0.0.10',
  username: 'root',
  password: 'secret',
  privateKey: 'PRIVATE_KEY',
  privateKeyPassphrase: ''
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

describe('SkillsCenterPage', () => {
  beforeEach(() => {
    window.localStorage.clear()
    useAppStore.setState(createInitialAppStoreState())
    vi.clearAllMocks()
  })

  it('loads skills, switches category, edits content and toggles enabled state', async () => {
    const instanceId = createConnectedInstance()
    const requestGatewayMock = vi.mocked(window.api.requestGateway)
    const executeSshCommandMock = vi.mocked(window.api.executeSshCommand)

    requestGatewayMock.mockImplementation(async ({ method }) => {
      if (method === 'skills.status') {
        return {
          success: true,
          message: 'mock skills status',
          payload: {
            workspaceDir: '/Users/test/workspace',
            managedSkillsDir: '/Users/test/.openclaw/skills',
            skills: [
              {
                name: 'system-debugger',
                description: 'system skill',
                source: 'openclaw-bundled',
                bundled: true,
                filePath: '/Users/test/.openclaw/bundled-skills/system-debugger/SKILL.md',
                baseDir: '/Users/test/.openclaw/bundled-skills/system-debugger',
                skillKey: 'system-debugger',
                disabled: false,
                eligible: true
              },
              {
                name: 'custom-writer',
                description: 'custom skill',
                source: 'workspace',
                bundled: false,
                filePath: '/Users/test/workspace/skills/custom-writer/SKILL.md',
                baseDir: '/Users/test/workspace/skills/custom-writer',
                skillKey: 'custom-writer',
                disabled: false,
                eligible: true
              }
            ]
          }
        }
      }

      if (method === 'skills.update') {
        return {
          success: true,
          message: 'mock update',
          payload: {
            ok: true,
            skillKey: 'custom-writer',
            config: {
              enabled: false
            }
          }
        }
      }

      return { success: true, message: 'mock default', payload: {} }
    })

    executeSshCommandMock.mockImplementation(async ({ command }) => {
      if (command.includes('/bundled-skills/system-debugger/SKILL.md')) {
        return {
          success: true,
          message: 'read system skill',
          stdout: '# System Skill\n',
          stderr: '',
          code: 0
        }
      }

      if (command.includes('/workspace/skills/custom-writer/SKILL.md') && command.includes('cat')) {
        return {
          success: true,
          message: 'read custom skill',
          stdout: '# Custom Skill\nInitial content',
          stderr: '',
          code: 0
        }
      }

      return {
        success: true,
        message: 'write custom skill',
        stdout: '',
        stderr: '',
        code: 0
      }
    })

    render(
      <MemoryRouter initialEntries={[`/skills?instanceId=${instanceId}`]}>
        <SkillsCenterPage />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getAllByText('system-debugger').length).toBeGreaterThan(0)
    })

    fireEvent.click(screen.getByRole('tab', { name: '自定义 Skill' }))

    await waitFor(() => {
      expect(screen.getByText('custom-writer')).toBeInTheDocument()
    })

    const textarea = await screen.findByRole('textbox')
    await waitFor(() => {
      expect(textarea).toHaveValue('# Custom Skill\nInitial content')
    })

    fireEvent.change(textarea, {
      target: { value: '# Custom Skill\nUpdated content' }
    })
    fireEvent.click(screen.getByRole('button', { name: '保存' }))

    await waitFor(() => {
      const hasWriteCall = executeSshCommandMock.mock.calls.some(
        ([payload]) =>
          payload.command.includes('/workspace/skills/custom-writer/SKILL.md') &&
          payload.command.includes('base64')
      )
      expect(hasWriteCall).toBe(true)
    })

    fireEvent.click(screen.getByRole('switch', { name: 'custom-writer 开启开关' }))

    await waitFor(() => {
      expect(requestGatewayMock).toHaveBeenCalledWith(
        expect.objectContaining({
          instanceId,
          method: 'skills.update',
          params: {
            skillKey: 'custom-writer',
            enabled: false
          }
        })
      )
    })
  })

  it('creates custom skill from sidebar footer action', async () => {
    const instanceId = createConnectedInstance()
    const requestGatewayMock = vi.mocked(window.api.requestGateway)
    const executeSshCommandMock = vi.mocked(window.api.executeSshCommand)

    let skillsStatusCount = 0

    requestGatewayMock.mockImplementation(async ({ method }) => {
      if (method === 'skills.status') {
        skillsStatusCount += 1
        return {
          success: true,
          message: 'mock skills status',
          payload: {
            workspaceDir: '/Users/test/workspace',
            managedSkillsDir: '/Users/test/.openclaw/skills',
            skills:
              skillsStatusCount === 1
                ? [
                    {
                      name: 'system-debugger',
                      description: 'system skill',
                      source: 'openclaw-bundled',
                      bundled: true,
                      filePath: '/Users/test/.openclaw/bundled-skills/system-debugger/SKILL.md',
                      baseDir: '/Users/test/.openclaw/bundled-skills/system-debugger',
                      skillKey: 'system-debugger',
                      disabled: false,
                      eligible: true
                    }
                  ]
                : [
                    {
                      name: 'system-debugger',
                      description: 'system skill',
                      source: 'openclaw-bundled',
                      bundled: true,
                      filePath: '/Users/test/.openclaw/bundled-skills/system-debugger/SKILL.md',
                      baseDir: '/Users/test/.openclaw/bundled-skills/system-debugger',
                      skillKey: 'system-debugger',
                      disabled: false,
                      eligible: true
                    },
                    {
                      name: 'qa-helper',
                      description: 'custom skill',
                      source: 'workspace',
                      bundled: false,
                      filePath: '/Users/test/workspace/skills/qa-helper/SKILL.md',
                      baseDir: '/Users/test/workspace/skills/qa-helper',
                      skillKey: 'qa-helper',
                      disabled: false,
                      eligible: true
                    }
                  ]
          }
        }
      }

      return { success: true, message: 'mock default', payload: {} }
    })

    executeSshCommandMock.mockImplementation(async ({ command }) => {
      if (command.includes('/bundled-skills/system-debugger/SKILL.md')) {
        return {
          success: true,
          message: 'read system skill',
          stdout: '# System Skill\n',
          stderr: '',
          code: 0
        }
      }

      if (command.includes('/workspace/skills/qa-helper/SKILL.md') && command.includes('cat')) {
        return {
          success: true,
          message: 'read custom skill',
          stdout: '# QA Helper\n',
          stderr: '',
          code: 0
        }
      }

      return {
        success: true,
        message: 'write custom skill',
        stdout: '',
        stderr: '',
        code: 0
      }
    })

    render(
      <MemoryRouter initialEntries={[`/skills?instanceId=${instanceId}`]}>
        <SkillsCenterPage />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getAllByText('system-debugger').length).toBeGreaterThan(0)
    })

    fireEvent.click(screen.getByRole('tab', { name: '自定义 Skill' }))
    fireEvent.click(screen.getByRole('button', { name: '新增 Skill' }))

    fireEvent.change(screen.getByLabelText('技能名称'), {
      target: { value: 'QA Helper' }
    })
    fireEvent.click(screen.getByRole('button', { name: '确认新增' }))

    await waitFor(() => {
      const hasWriteCall = executeSshCommandMock.mock.calls.some(
        ([payload]) =>
          payload.command.includes('/workspace/skills/qa-helper/SKILL.md') &&
          payload.command.includes('base64')
      )
      expect(hasWriteCall).toBe(true)
    })

    await waitFor(() => {
      expect(screen.getAllByText('qa-helper').length).toBeGreaterThan(0)
    })
  })

  it('deletes custom skill', async () => {
    const instanceId = createConnectedInstance()
    const requestGatewayMock = vi.mocked(window.api.requestGateway)
    const executeSshCommandMock = vi.mocked(window.api.executeSshCommand)
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)

    let skillDeleted = false

    requestGatewayMock.mockImplementation(async ({ method }) => {
      if (method === 'skills.status') {
        return {
          success: true,
          message: 'mock skills status',
          payload: {
            workspaceDir: '/Users/test/workspace',
            managedSkillsDir: '/Users/test/.openclaw/skills',
            skills: skillDeleted
              ? [
                  {
                    name: 'system-debugger',
                    description: 'system skill',
                    source: 'openclaw-bundled',
                    bundled: true,
                    filePath: '/Users/test/.openclaw/bundled-skills/system-debugger/SKILL.md',
                    baseDir: '/Users/test/.openclaw/bundled-skills/system-debugger',
                    skillKey: 'system-debugger',
                    disabled: false,
                    eligible: true
                  }
                ]
              : [
                  {
                    name: 'system-debugger',
                    description: 'system skill',
                    source: 'openclaw-bundled',
                    bundled: true,
                    filePath: '/Users/test/.openclaw/bundled-skills/system-debugger/SKILL.md',
                    baseDir: '/Users/test/.openclaw/bundled-skills/system-debugger',
                    skillKey: 'system-debugger',
                    disabled: false,
                    eligible: true
                  },
                  {
                    name: 'custom-writer',
                    description: 'custom skill',
                    source: 'workspace',
                    bundled: false,
                    filePath: '/Users/test/workspace/skills/custom-writer/SKILL.md',
                    baseDir: '/Users/test/workspace/skills/custom-writer',
                    skillKey: 'custom-writer',
                    disabled: false,
                    eligible: true
                  }
                ]
          }
        }
      }

      return { success: true, message: 'mock default', payload: {} }
    })

    executeSshCommandMock.mockImplementation(async ({ command }) => {
      if (command.includes('/bundled-skills/system-debugger/SKILL.md')) {
        return {
          success: true,
          message: 'read system skill',
          stdout: '# System Skill\n',
          stderr: '',
          code: 0
        }
      }

      if (command.includes('/workspace/skills/custom-writer/SKILL.md') && command.includes('cat')) {
        return {
          success: true,
          message: 'read custom skill',
          stdout: '# Custom Skill\n',
          stderr: '',
          code: 0
        }
      }

      skillDeleted = true
      return {
        success: true,
        message: 'delete custom skill',
        stdout: '',
        stderr: '',
        code: 0
      }
    })

    render(
      <MemoryRouter initialEntries={[`/skills?instanceId=${instanceId}`]}>
        <SkillsCenterPage />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getAllByText('system-debugger').length).toBeGreaterThan(0)
    })

    fireEvent.click(screen.getByRole('tab', { name: '自定义 Skill' }))

    await waitFor(() => {
      expect(screen.getAllByText('custom-writer').length).toBeGreaterThan(0)
    })

    fireEvent.click(screen.getByRole('button', { name: '删除 Skill' }))

    expect(confirmSpy).toHaveBeenCalled()

    await waitFor(() => {
      const hasDeleteCall = executeSshCommandMock.mock.calls.some(
        ([payload]) =>
          payload.command.includes('/workspace/skills/custom-writer') &&
          payload.command.includes('rm -rf')
      )
      expect(hasDeleteCall).toBe(true)
    })

    await waitFor(() => {
      expect(screen.queryByText('custom-writer')).not.toBeInTheDocument()
    })

    confirmSpy.mockRestore()
  })
})
