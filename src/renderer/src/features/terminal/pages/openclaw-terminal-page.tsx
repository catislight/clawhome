import '@xterm/xterm/css/xterm.css'

import { Eraser } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { FitAddon } from '@xterm/addon-fit'
import { Terminal as XTerm } from '@xterm/xterm'

import { useAppI18n } from '@/shared/i18n/app-i18n'
import AppShellContentArea from '@/shared/layout/app-shell-content-area'
import { Button } from '@/shared/ui/button'
import {
  closeTerminalSession,
  createTerminalSession,
  onTerminalData,
  onTerminalExit,
  resizeTerminalSession,
  writeTerminalInput
} from '@/shared/api/app-api'

type TerminalConnectionState = 'connecting' | 'connected' | 'closed' | 'error'

const MIN_COLS = 20
const MIN_ROWS = 8

function toSafeTerminalSize(terminal: XTerm): { cols: number; rows: number } {
  return {
    cols: Math.max(Math.floor(terminal.cols), MIN_COLS),
    rows: Math.max(Math.floor(terminal.rows), MIN_ROWS)
  }
}

function safeFitTerminal(fitAddon: FitAddon): void {
  try {
    fitAddon.fit()
  } catch {
    // xterm can throw during intermediate mount/dispose timing in strict-mode.
  }
}

function OpenClawTerminalPage(): React.JSX.Element {
  const { t } = useAppI18n()
  const terminalHostRef = useRef<HTMLDivElement | null>(null)
  const terminalRef = useRef<XTerm | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const activeSessionIdRef = useRef<string | null>(null)
  const disposedRef = useRef(false)

  const [sessionId, setSessionId] = useState<string | null>(null)
  const [connectionState, setConnectionState] = useState<TerminalConnectionState>('connecting')
  const [statusMessage, setStatusMessage] = useState(t('terminal.status.connecting'))
  const [restarting, setRestarting] = useState(false)

  const reconnectSession = useCallback(async () => {
    const terminal = terminalRef.current
    const fitAddon = fitAddonRef.current

    if (!terminal || !fitAddon || disposedRef.current) {
      return
    }

    const previousSessionId = activeSessionIdRef.current

    if (previousSessionId) {
      activeSessionIdRef.current = null
      setSessionId(null)
      await closeTerminalSession({ sessionId: previousSessionId })
    }

    setConnectionState('connecting')
    setStatusMessage(t('terminal.status.connecting'))

    safeFitTerminal(fitAddon)

    const createResult = await createTerminalSession({
      ...toSafeTerminalSize(terminal)
    })

    if (disposedRef.current) {
      if (createResult.success && createResult.sessionId) {
        await closeTerminalSession({ sessionId: createResult.sessionId })
      }
      return
    }

    if (!createResult.success || !createResult.sessionId) {
      const failedMessage = createResult.message || t('terminal.error.createFailed')
      setConnectionState('error')
      setStatusMessage(failedMessage)
      terminal.write(`\r\n\u001b[31m${failedMessage}\u001b[0m\r\n`)
      return
    }

    activeSessionIdRef.current = createResult.sessionId
    setSessionId(createResult.sessionId)
    setConnectionState('connected')
    setStatusMessage(
      createResult.pid
        ? t('terminal.status.connectedWithPid', { pid: createResult.pid })
        : t('terminal.status.connected')
    )

    const size = toSafeTerminalSize(terminal)
    await resizeTerminalSession({
      sessionId: createResult.sessionId,
      cols: size.cols,
      rows: size.rows
    })

    terminal.focus()
  }, [t])

  useEffect(() => {
    const terminalHost = terminalHostRef.current

    if (!terminalHost) {
      return
    }

    disposedRef.current = false

    const terminal = new XTerm({
      cursorBlink: true,
      convertEol: true,
      scrollback: 3000,
      fontSize: 13,
      lineHeight: 1.3,
      fontFamily: 'Menlo, Monaco, Consolas, monospace',
      theme: {
        background: '#0B1220',
        foreground: '#E2E8F0',
        cursor: '#F8FAFC',
        selectionBackground: '#334155'
      }
    })

    const fitAddon = new FitAddon()

    terminal.loadAddon(fitAddon)
    terminal.open(terminalHost)
    safeFitTerminal(fitAddon)
    terminal.focus()
    terminal.write(`\u001b[90m${t('terminal.banner.startup')}\u001b[0m\r\n`)

    terminalRef.current = terminal
    fitAddonRef.current = fitAddon

    const inputDisposable = terminal.onData((input) => {
      const activeSessionId = activeSessionIdRef.current

      if (!activeSessionId) {
        return
      }

      void writeTerminalInput({
        sessionId: activeSessionId,
        data: input
      })
    })

    const resizeDisposable = terminal.onResize(({ cols, rows }) => {
      const activeSessionId = activeSessionIdRef.current

      if (!activeSessionId) {
        return
      }

      void resizeTerminalSession({
        sessionId: activeSessionId,
        cols,
        rows
      })
    })

    const removeDataListener = onTerminalData((event) => {
      if (disposedRef.current || terminalRef.current !== terminal) {
        return
      }

      if (event.sessionId !== activeSessionIdRef.current) {
        return
      }

      terminal.write(event.data)
    })

    const removeExitListener = onTerminalExit((event) => {
      if (disposedRef.current || terminalRef.current !== terminal) {
        return
      }

      if (event.sessionId !== activeSessionIdRef.current) {
        return
      }

      activeSessionIdRef.current = null
      setSessionId(null)
      setConnectionState('closed')
      setStatusMessage(t('terminal.status.exited', { exitCode: event.exitCode }))
      terminal.write(
        `\r\n\u001b[33m[terminal exited: code ${event.exitCode}, signal ${event.signal}]\u001b[0m\r\n`
      )
    })

    const resizeObserver = new ResizeObserver(() => {
      if (disposedRef.current || terminalRef.current !== terminal) {
        return
      }

      safeFitTerminal(fitAddon)

      const activeSessionId = activeSessionIdRef.current

      if (!activeSessionId) {
        return
      }

      const size = toSafeTerminalSize(terminal)
      void resizeTerminalSession({
        sessionId: activeSessionId,
        cols: size.cols,
        rows: size.rows
      })
    })

    resizeObserver.observe(terminalHost)
    const reconnectTimerId = window.setTimeout(() => {
      void reconnectSession()
    }, 0)

    return () => {
      disposedRef.current = true

      window.clearTimeout(reconnectTimerId)
      resizeObserver.disconnect()
      inputDisposable.dispose()
      resizeDisposable.dispose()
      removeDataListener()
      removeExitListener()

      const activeSessionId = activeSessionIdRef.current
      activeSessionIdRef.current = null

      if (activeSessionId) {
        void closeTerminalSession({ sessionId: activeSessionId })
      }

      terminalRef.current = null
      fitAddonRef.current = null
      terminal.dispose()
    }
  }, [reconnectSession, t])

  useEffect(() => {
    if (connectionState === 'connecting') {
      setStatusMessage(t('terminal.status.connecting'))
    }
  }, [connectionState, t])

  const connectionStateText = useMemo(() => {
    if (connectionState === 'connected') {
      return t('terminal.connection.connected')
    }

    if (connectionState === 'connecting') {
      return t('terminal.connection.connecting')
    }

    if (connectionState === 'error') {
      return t('terminal.connection.error')
    }

    return t('terminal.connection.closed')
  }, [connectionState, t])

  const connectionStateTagClassName = useMemo(() => {
    if (connectionState === 'connected') {
      return 'bg-emerald-50 text-emerald-700 border border-emerald-200'
    }

    if (connectionState === 'connecting') {
      return 'bg-amber-50 text-amber-700 border border-amber-200'
    }

    if (connectionState === 'error') {
      return 'bg-rose-50 text-rose-700 border border-rose-200'
    }

    return 'bg-slate-100 text-slate-600 border border-slate-200'
  }, [connectionState])

  return (
    <AppShellContentArea
      showHeaderWithoutConnectedInstance
      contentScrollable={false}
      disableInnerPadding
      header={
        <div className="flex w-full items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <span className="text-sm font-semibold text-foreground">{t('terminal.header.currentStatus')}</span>
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] ${connectionStateTagClassName}`}
            >
              {connectionStateText}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={restarting || connectionState === 'connecting'}
              onClick={() => {
                setRestarting(true)
                void reconnectSession().finally(() => {
                  setRestarting(false)
                })
              }}
            >
              {restarting ? t('terminal.action.reconnecting') : t('terminal.action.reconnect')}
            </Button>

            <Button
              type="button"
              size="icon"
              variant="ghost"
              aria-label={t('terminal.action.clear')}
              title={t('terminal.action.clear')}
              onClick={() => {
                terminalRef.current?.clear()
              }}
            >
              <Eraser className="size-3.5" />
            </Button>
          </div>
        </div>
      }
    >
      <section className="flex h-full min-h-0 flex-col px-4 py-3">
        <div
          ref={terminalHostRef}
          className="min-h-0 flex-1 overflow-hidden rounded-[0.8rem] border border-black/10 bg-[#0B1220] p-2"
        />

        <div className="mt-2 flex shrink-0 items-center justify-between gap-3 text-xs text-muted-foreground">
          <span className="truncate">{statusMessage}</span>
          <span className="shrink-0">
            {sessionId
              ? t('terminal.session.withId', { id: sessionId.slice(-6) })
              : t('terminal.session.none')}
          </span>
        </div>
      </section>
    </AppShellContentArea>
  )
}

export default OpenClawTerminalPage
