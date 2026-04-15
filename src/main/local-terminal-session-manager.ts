import { type WebContents } from 'electron'
import { existsSync, statSync } from 'fs'
import { homedir } from 'os'
import { resolve } from 'path'

import { spawn, type IPty } from '@lydell/node-pty'

import {
  IPC_CHANNELS,
  type TerminalSessionActionResult,
  type TerminalSessionClosePayload,
  type TerminalSessionCreatePayload,
  type TerminalSessionCreateResult,
  type TerminalSessionResizePayload,
  type TerminalSessionWritePayload
} from '../preload/bridge-contract'

type ManagedTerminalSession = {
  id: string
  ownerWebContentsId: number
  pty: IPty
}

const DEFAULT_COLS = 120
const DEFAULT_ROWS = 32
const MIN_COLS = 20
const MIN_ROWS = 8

function clampInteger(value: number | undefined, fallback: number, min: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback
  }

  return Math.max(Math.floor(value), min)
}

function resolveTerminalShell(shellFromPayload: string | undefined): string {
  if (shellFromPayload?.trim()) {
    return shellFromPayload.trim().split(/\s+/)[0]
  }

  if (process.platform === 'win32') {
    return process.env.COMSPEC || 'powershell.exe'
  }

  if (process.env.SHELL?.trim()) {
    return process.env.SHELL.trim().split(/\s+/)[0]
  }

  return '/bin/zsh'
}

function resolveTerminalCwd(cwdFromPayload: string | undefined): string {
  const fallbackCwd = homedir()

  if (!cwdFromPayload?.trim()) {
    return fallbackCwd
  }

  const resolvedCwd = resolve(cwdFromPayload)

  if (!existsSync(resolvedCwd)) {
    return fallbackCwd
  }

  try {
    return statSync(resolvedCwd).isDirectory() ? resolvedCwd : fallbackCwd
  } catch {
    return fallbackCwd
  }
}

function makeSessionId(): string {
  return `terminal-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function successActionResult(message: string): TerminalSessionActionResult {
  return {
    success: true,
    message
  }
}

function failedActionResult(message: string): TerminalSessionActionResult {
  return {
    success: false,
    message
  }
}

export class LocalTerminalSessionManager {
  private sessions = new Map<string, ManagedTerminalSession>()
  private ownerSessionIds = new Map<number, Set<string>>()
  private trackedOwners = new Set<number>()

  createSession(
    ownerWebContents: WebContents,
    payload: TerminalSessionCreatePayload
  ): TerminalSessionCreateResult {
    const sessionId = makeSessionId()
    const cols = clampInteger(payload.cols, DEFAULT_COLS, MIN_COLS)
    const rows = clampInteger(payload.rows, DEFAULT_ROWS, MIN_ROWS)
    const shell = resolveTerminalShell(payload.shell)
    const cwd = resolveTerminalCwd(payload.cwd)

    try {
      const pty = spawn(shell, [], {
        name: 'xterm-256color',
        cols,
        rows,
        cwd,
        env: {
          ...process.env,
          TERM: 'xterm-256color'
        }
      })

      const session: ManagedTerminalSession = {
        id: sessionId,
        ownerWebContentsId: ownerWebContents.id,
        pty
      }

      this.sessions.set(sessionId, session)
      this.bindOwnerSession(session)
      this.ensureOwnerCleanup(ownerWebContents)

      pty.onData((data) => {
        if (ownerWebContents.isDestroyed()) {
          return
        }

        ownerWebContents.send(IPC_CHANNELS.terminalSessionData, {
          sessionId,
          data
        })
      })

      pty.onExit(({ exitCode, signal }) => {
        if (!ownerWebContents.isDestroyed()) {
          ownerWebContents.send(IPC_CHANNELS.terminalSessionExit, {
            sessionId,
            exitCode,
            signal
          })
        }

        this.detachSession(sessionId)
      })

      return {
        success: true,
        message: '终端会话创建成功',
        sessionId,
        pid: pty.pid
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : '终端会话创建失败'

      return {
        success: false,
        message,
        sessionId: '',
        pid: null
      }
    }
  }

  writeInput(
    ownerWebContentsId: number,
    payload: TerminalSessionWritePayload
  ): TerminalSessionActionResult {
    const session = this.getOwnedSession(ownerWebContentsId, payload.sessionId)

    if (!session) {
      return failedActionResult('终端会话不存在或已关闭')
    }

    try {
      session.pty.write(payload.data)
      return successActionResult('终端输入写入成功')
    } catch (error) {
      const message = error instanceof Error ? error.message : '终端输入写入失败'
      return failedActionResult(message)
    }
  }

  resizeSession(
    ownerWebContentsId: number,
    payload: TerminalSessionResizePayload
  ): TerminalSessionActionResult {
    const session = this.getOwnedSession(ownerWebContentsId, payload.sessionId)

    if (!session) {
      return failedActionResult('终端会话不存在或已关闭')
    }

    const cols = clampInteger(payload.cols, DEFAULT_COLS, MIN_COLS)
    const rows = clampInteger(payload.rows, DEFAULT_ROWS, MIN_ROWS)

    try {
      session.pty.resize(cols, rows)
      return successActionResult('终端窗口尺寸更新成功')
    } catch (error) {
      const message = error instanceof Error ? error.message : '终端窗口尺寸更新失败'
      return failedActionResult(message)
    }
  }

  closeSession(
    ownerWebContentsId: number,
    payload: TerminalSessionClosePayload
  ): TerminalSessionActionResult {
    const session = this.getOwnedSession(ownerWebContentsId, payload.sessionId)

    if (!session) {
      return successActionResult('终端会话已关闭')
    }

    this.disposeSession(session.id, true)

    return successActionResult('终端会话已关闭')
  }

  async disposeAll(): Promise<void> {
    const sessionIds = [...this.sessions.keys()]

    for (const sessionId of sessionIds) {
      this.disposeSession(sessionId, true)
    }

    this.sessions.clear()
    this.ownerSessionIds.clear()
    this.trackedOwners.clear()
  }

  private ensureOwnerCleanup(ownerWebContents: WebContents): void {
    if (this.trackedOwners.has(ownerWebContents.id)) {
      return
    }

    this.trackedOwners.add(ownerWebContents.id)
    ownerWebContents.once('destroyed', () => {
      this.disposeOwnerSessions(ownerWebContents.id)
      this.trackedOwners.delete(ownerWebContents.id)
    })
  }

  private bindOwnerSession(session: ManagedTerminalSession): void {
    const current = this.ownerSessionIds.get(session.ownerWebContentsId)

    if (current) {
      current.add(session.id)
      return
    }

    this.ownerSessionIds.set(session.ownerWebContentsId, new Set([session.id]))
  }

  private disposeOwnerSessions(ownerWebContentsId: number): void {
    const sessionIds = this.ownerSessionIds.get(ownerWebContentsId)

    if (!sessionIds || sessionIds.size === 0) {
      this.ownerSessionIds.delete(ownerWebContentsId)
      return
    }

    for (const sessionId of sessionIds) {
      this.disposeSession(sessionId, true)
    }

    this.ownerSessionIds.delete(ownerWebContentsId)
  }

  private disposeSession(sessionId: string, shouldKill: boolean): void {
    const session = this.detachSession(sessionId)

    if (!session || !shouldKill) {
      return
    }

    try {
      session.pty.kill()
    } catch {
      // ignore pty kill error when process already exited.
    }
  }

  private detachSession(sessionId: string): ManagedTerminalSession | null {
    const session = this.sessions.get(sessionId)

    if (!session) {
      return null
    }

    this.sessions.delete(sessionId)

    const ownerSessions = this.ownerSessionIds.get(session.ownerWebContentsId)

    if (ownerSessions) {
      ownerSessions.delete(sessionId)
      if (ownerSessions.size === 0) {
        this.ownerSessionIds.delete(session.ownerWebContentsId)
      }
    }

    return session
  }

  private getOwnedSession(
    ownerWebContentsId: number,
    sessionId: string
  ): ManagedTerminalSession | null {
    const session = this.sessions.get(sessionId)

    if (!session) {
      return null
    }

    if (session.ownerWebContentsId !== ownerWebContentsId) {
      return null
    }

    return session
  }
}
