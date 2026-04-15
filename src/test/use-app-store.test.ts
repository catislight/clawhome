import { beforeEach, describe, expect, it } from 'vitest'

import { DEFAULT_SEND_KEY } from '../renderer/src/features/preferences/lib/app-preferences'
import type { SshConnectionFormValues } from '../renderer/src/features/instances/model/ssh-connection'
import { createInitialAppStoreState, useAppStore } from '../renderer/src/features/instances/store/use-app-store'

const mockConnectionConfig: SshConnectionFormValues = {
  title: 'root@production',
  port: 22,
  host: '192.168.1.10',
  username: 'root',
  password: 'secret',
  privateKey: 'PRIVATE_KEY',
  privateKeyPassphrase: ''
}

describe('useAppStore', () => {
  beforeEach(() => {
    window.localStorage.clear()
    useAppStore.setState(createInitialAppStoreState())
  })

  it('creates an openclaw instance and stores its connection config', () => {
    const instanceId = useAppStore.getState().createOpenClawInstance({
      name: '生产集群',
      description: '用于接入线上流量'
    })

    useAppStore.getState().saveConnectionConfig(instanceId, mockConnectionConfig)

    const createdInstance = useAppStore
      .getState()
      .instances.find((instance) => instance.id === instanceId)

    expect(createdInstance).toBeDefined()
    expect(createdInstance?.name).toBe('生产集群')
    expect(createdInstance?.connectionConfig?.host).toBe('192.168.1.10')
    expect(createdInstance?.connectionState).toBe('idle')
  })

  it('updates connection state and keeps last successful time', () => {
    const instanceId = useAppStore.getState().createOpenClawInstance({
      name: '灰度环境',
      description: ''
    })

    useAppStore.getState().setConnectionState(instanceId, 'connected', {
      lastConnectedAt: '2026-03-20T07:00:00.000Z',
      lastError: null
    })

    const instance = useAppStore
      .getState()
      .instances.find((currentInstance) => currentInstance.id === instanceId)

    expect(instance?.connectionState).toBe('connected')
    expect(instance?.lastConnectedAt).toBe('2026-03-20T07:00:00.000Z')
    expect(instance?.lastError).toBeNull()
  })

  it('deletes an instance and clears workspace selection when needed', () => {
    const selectedInstanceId = useAppStore.getState().createOpenClawInstance({
      name: '线上',
      description: '生产环境'
    })
    const backupInstanceId = useAppStore.getState().createOpenClawInstance({
      name: '备用',
      description: '测试'
    })

    useAppStore.getState().setWorkspaceInstanceId(selectedInstanceId)
    useAppStore.getState().deleteOpenClawInstance(selectedInstanceId)

    const { instances, workspaceInstanceId } = useAppStore.getState()
    const remainingIds = instances.map((instance) => instance.id)

    expect(remainingIds).not.toContain(selectedInstanceId)
    expect(remainingIds).toContain(backupInstanceId)
    expect(workspaceInstanceId).toBeNull()
  })

  it('updates preferences for language and send key', () => {
    expect(useAppStore.getState().preferences.language).toBe('zh-CN')
    expect(useAppStore.getState().preferences.sendKey).toBe(DEFAULT_SEND_KEY)

    useAppStore.getState().setPreferencesLanguage('en-US')
    useAppStore.getState().setPreferencesSendKey('Mod-Shift-Enter')

    expect(useAppStore.getState().preferences.language).toBe('en-US')
    expect(useAppStore.getState().preferences.sendKey).toBe('Mod-Shift-Enter')
  })
})
