import { useState } from 'react'

import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { executeSshCommand } from '@/shared/api/app-api'
import type { SshConnectionFormValues } from '@/features/instances/model/ssh-connection'
import { useAppI18n } from '@/shared/i18n/app-i18n'

type SshCommandExecutorProps = {
  connection: SshConnectionFormValues | null
}

type CommandLogEntry = {
  id: string
  command: string
  at: string
  running: boolean
  success: boolean
  message: string
  stdout: string
  stderr: string
  code: number | null
}

function SshCommandExecutor({ connection }: SshCommandExecutorProps): React.JSX.Element {
  const { t } = useAppI18n()
  const [command, setCommand] = useState('uname -a')
  const [running, setRunning] = useState(false)
  const [logs, setLogs] = useState<CommandLogEntry[]>([])

  const handleExecute = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault()

    const trimmedCommand = command.trim()

    if (!connection || !trimmedCommand) {
      return
    }

    const logId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

    setRunning(true)
    setLogs((current) => [
      {
        id: logId,
        command: trimmedCommand,
        at: new Date().toLocaleString(),
        running: true,
        success: false,
        message: t('instances.sshExec.running'),
        stdout: '',
        stderr: '',
        code: null
      },
      ...current
    ])

    try {
      const response = await executeSshCommand({
        ...connection,
        command: trimmedCommand
      })

      setLogs((current) =>
        current.map((item) =>
          item.id === logId
            ? {
                ...item,
                running: false,
                success: response.success,
                message: response.message,
                stdout: response.stdout,
                stderr: response.stderr,
                code: response.code
              }
            : item
        )
      )
    } catch (error) {
      const message = error instanceof Error ? error.message : t('instances.sshExec.failed')

      setLogs((current) =>
        current.map((item) =>
          item.id === logId
            ? {
                ...item,
                running: false,
                success: false,
                message,
                stdout: '',
                stderr: '',
                code: null
              }
            : item
        )
      )
    } finally {
      setRunning(false)
    }
  }

  return (
    <section className="max-w-2xl border border-border bg-background p-4">
      <h2 className="text-base font-semibold">{t('instances.sshExec.title')}</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {connection
          ? t('instances.sshExec.currentConnection', {
              title: connection.title,
              host: connection.host,
              port: connection.port
            })
          : t('instances.sshExec.needConnection')}
      </p>

      <form className="mt-4 flex flex-col gap-3" onSubmit={handleExecute}>
        <label className="text-sm font-medium" htmlFor="ssh-command-input">
          {t('instances.sshExec.field.command')}
        </label>
        <Input
          density="sm"
          id="ssh-command-input"
          value={command}
          onChange={(event) => setCommand(event.target.value)}
          placeholder={t('instances.sshExec.field.command.placeholder')}
          disabled={!connection || running}
          required
        />

        <div>
          <Button type="submit" disabled={!connection || running}>
            {running ? t('instances.sshExec.action.running') : t('instances.sshExec.action.run')}
          </Button>
        </div>
      </form>

      <div className="mt-5 border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-3 py-2">
          <p className="text-sm font-medium">{t('instances.sshExec.logs.title')}</p>
          <p className="text-xs text-muted-foreground">
            {t('instances.sshExec.logs.count', { count: logs.length })}
          </p>
        </div>

        {logs.length === 0 ? (
          <p className="p-3 text-xs text-muted-foreground">{t('instances.sshExec.logs.empty')}</p>
        ) : (
          <div className="max-h-96 overflow-y-auto">
            {logs.map((entry) => (
              <div key={entry.id} className="border-b border-border p-3 last:border-b-0">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <code className="text-xs font-medium">$ {entry.command}</code>
                  <span className="text-[11px] text-muted-foreground">{entry.at}</span>
                </div>

                <p
                  className={
                    entry.running
                      ? 'text-xs text-muted-foreground'
                      : entry.success
                        ? 'text-xs text-green-600'
                        : 'text-xs text-red-600'
                  }
                >
                  {entry.message}{' '}
                  {entry.code !== null
                    ? t('instances.sshExec.logs.exitCode', { code: entry.code })
                    : ''}
                </p>

                <div className="mt-2 grid gap-2">
                  <div>
                    <p className="mb-1 text-[11px] font-medium text-muted-foreground">
                      {t('instances.sshExec.logs.stdout')}
                    </p>
                    <pre className="max-h-44 overflow-auto bg-background p-2 text-xs leading-5">
                      {entry.stdout || t('instances.sshExec.logs.emptyOutput')}
                    </pre>
                  </div>

                  <div>
                    <p className="mb-1 text-[11px] font-medium text-muted-foreground">
                      {t('instances.sshExec.logs.stderr')}
                    </p>
                    <pre className="max-h-44 overflow-auto bg-background p-2 text-xs leading-5">
                      {entry.stderr || t('instances.sshExec.logs.emptyOutput')}
                    </pre>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

export default SshCommandExecutor
