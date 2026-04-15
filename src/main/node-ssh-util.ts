import { NodeSSH, type Config as NodeSSHConfig } from 'node-ssh'

export type SshConnectionConfig = NodeSSHConfig

export type SshCommandExecutionResult = {
  stdout: string
  stderr: string
  code: number | null
}

function escapeSingleQuotes(command: string): string {
  return command.replace(/'/g, `'"'"'`)
}

function normalizeShellStderr(stderr: string): string {
  return stderr
    .replace(/(?:bash|zsh): cannot set terminal process group \([^)]+\): Inappropriate ioctl for device\n?/g, '')
    .replace(/(?:bash|zsh): no job control in this shell\n?/g, '')
    .replace(/^\s*exit\s*$/gm, '')
    .trim()
}

function buildShellCommand(command: string): string {
  const commandWithPath = `export PATH="$PATH:$HOME/.local/bin:$HOME/bin:$HOME/.npm-global/bin:$HOME/.cargo/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:/opt/homebrew/bin:/snap/bin"; ${command}`
  return escapeSingleQuotes(commandWithPath)
}

function buildInitScript(shell: 'bash' | 'zsh' | 'sh'): string {
  if (shell === 'bash') {
    return 'shopt -s expand_aliases 2>/dev/null || true; if [ -f ~/.bashrc ]; then source ~/.bashrc; fi; if [ -f ~/.bash_profile ]; then source ~/.bash_profile; fi; if [ -f ~/.profile ]; then source ~/.profile; fi;'
  }

  if (shell === 'zsh') {
    return 'if [ -f ~/.zshrc ]; then source ~/.zshrc; fi; if [ -f ~/.zprofile ]; then source ~/.zprofile; fi; if [ -f ~/.profile ]; then source ~/.profile; fi;'
  }

  return 'if [ -f ~/.profile ]; then . ~/.profile; fi;'
}

async function execWithTimeout(
  ssh: NodeSSH,
  command: string,
  timeoutMs: number
): Promise<{ stdout: string; stderr: string; code: number | null }> {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      ssh.dispose()
      reject(new Error(`SSH command timed out after ${Math.floor(timeoutMs / 1000)}s`))
    }, timeoutMs)

    ssh
      .execCommand(command)
      .then((result) => {
        clearTimeout(timeoutId)
        resolve(result)
      })
      .catch((error) => {
        clearTimeout(timeoutId)
        reject(error)
      })
  })
}

async function runInShell(
  ssh: NodeSSH,
  shell: 'bash' | 'zsh' | 'sh',
  command: string,
  timeoutMs: number
): Promise<SshCommandExecutionResult> {
  const escapedCommand = buildShellCommand(command)
  const initScript = buildInitScript(shell)

  const shellMode = shell === 'sh' ? '-lc' : '-ic'
  const result = await execWithTimeout(
    ssh,
    `${shell} ${shellMode} '${initScript} ${escapedCommand}; exit' < /dev/null`,
    timeoutMs
  )

  return {
    stdout: result.stdout,
    stderr: normalizeShellStderr(result.stderr),
    code: result.code
  }
}

function isCommandNotFound(result: SshCommandExecutionResult): boolean {
  const stderr = result.stderr.toLowerCase()
  return result.code === 127 && stderr.includes('not found')
}

function getCommandBinary(command: string): string {
  const token = command.trim().split(/\s+/)[0]
  return token || command.trim()
}

async function buildCommandNotFoundDiagnostics(
  ssh: NodeSSH,
  command: string,
  timeoutMs: number,
  attempts: string[]
): Promise<string> {
  const binary = getCommandBinary(command)
  const escapedBinary = escapeSingleQuotes(binary)

  try {
    const diag = await execWithTimeout(
      ssh,
      `bash -ic 'if [ -f ~/.bashrc ]; then source ~/.bashrc; fi; if [ -f ~/.bash_profile ]; then source ~/.bash_profile; fi; if [ -f ~/.profile ]; then source ~/.profile; fi; echo "whoami=$(whoami)"; echo "shell=$SHELL"; echo "path=$PATH"; echo "lookup=${escapedBinary}"; command -v '${escapedBinary}' || which '${escapedBinary}' || type '${escapedBinary}' || true' < /dev/null`,
      timeoutMs
    )

    const parts = [
      attempts.join('\n'),
      '--- diagnostics ---',
      (diag.stdout || '').trim(),
      normalizeShellStderr(diag.stderr || '')
    ].filter(Boolean)

    return parts.join('\n')
  } catch (error) {
    const message = error instanceof Error ? error.message : 'diagnostics failed'
    return [attempts.join('\n'), '--- diagnostics ---', message].join('\n')
  }
}

export async function createSshClient(config: SshConnectionConfig): Promise<NodeSSH> {
  const ssh = new NodeSSH()
  await ssh.connect(config)
  return ssh
}

export async function withSshClient<T>(
  config: SshConnectionConfig,
  run: (ssh: NodeSSH) => Promise<T>
): Promise<T> {
  const ssh = await createSshClient(config)

  try {
    return await run(ssh)
  } finally {
    ssh.dispose()
  }
}

export async function testSshConnection(config: SshConnectionConfig): Promise<void> {
  await withSshClient(config, async () => undefined)
}

export async function executeSshCommand(
  config: SshConnectionConfig,
  command: string
): Promise<SshCommandExecutionResult> {
  return withSshClient(config, async (ssh) => {
    const shells: Array<'bash' | 'zsh' | 'sh'> = ['bash', 'zsh', 'sh']
    const timeoutMs = 20_000
    const attempts: string[] = []

    let lastResult: SshCommandExecutionResult = {
      stdout: '',
      stderr: 'No shell executed the command.',
      code: null
    }

    for (const shell of shells) {
      try {
        const result = await runInShell(ssh, shell, command, timeoutMs)
        lastResult = result
        attempts.push(`[${shell}] exit=${result.code} stderr=${(result.stderr || '').trim() || '(empty)'}`)

        if (!isCommandNotFound(result)) {
          return result
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'SSH command execution failed.'
        attempts.push(`[${shell}] error=${message}`)
      }
    }

    if (isCommandNotFound(lastResult)) {
      const diagnostics = await buildCommandNotFoundDiagnostics(ssh, command, timeoutMs, attempts)
      return {
        stdout: lastResult.stdout,
        stderr: diagnostics,
        code: lastResult.code
      }
    }

    return lastResult
  })
}
