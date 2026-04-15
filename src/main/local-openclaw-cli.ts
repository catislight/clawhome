import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)
const LOCAL_OPENCLAW_CLI_TIMEOUT_MS = 12_000

type OpenClawCliCandidate = {
  command: string
  argsPrefix: string[]
}

function createLocalCliEnv(): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env }

  if (process.platform !== 'win32') {
    return env
  }

  const pathKey = Object.keys(env).find((key) => key.toLowerCase() === 'path') ?? 'Path'
  const currentPath = env[pathKey] ?? ''
  const appDataPath = env.APPDATA

  if (!appDataPath) {
    return env
  }

  const npmGlobalBinPath = path.join(appDataPath, 'npm')
  const currentEntries = currentPath
    .split(';')
    .map((entry) => entry.trim().toLowerCase())
    .filter((entry) => entry.length > 0)
  const hasNpmGlobalBinPath = currentEntries.includes(npmGlobalBinPath.toLowerCase())

  if (!hasNpmGlobalBinPath) {
    env[pathKey] = currentPath ? `${currentPath};${npmGlobalBinPath}` : npmGlobalBinPath
  }

  return env
}

function createOpenClawCliCandidates(): OpenClawCliCandidate[] {
  const candidates: OpenClawCliCandidate[] =
    process.platform === 'win32'
      ? [
          {
            command: process.env.ComSpec || 'cmd.exe',
            argsPrefix: ['/d', '/s', '/c', 'openclaw']
          },
          {
            command: 'openclaw',
            argsPrefix: []
          }
        ]
      : [
          {
            command: 'openclaw',
            argsPrefix: []
          }
        ]

  const workspaceCliPath = path.join(process.cwd(), 'openclaw', 'openclaw.mjs')
  if (existsSync(workspaceCliPath)) {
    candidates.push({
      command: 'node',
      argsPrefix: [workspaceCliPath]
    })
  }

  return candidates
}

function normalizeCliOutput(value: string | null | undefined): string {
  return typeof value === 'string' ? value.trim() : ''
}

function formatCliErrorMessage(params: {
  command: string
  args: string[]
  stdout: string
  stderr: string
  causeMessage: string
}): string {
  const commandLine = [params.command, ...params.args].join(' ')
  const stderr = normalizeCliOutput(params.stderr)
  const stdout = normalizeCliOutput(params.stdout)
  const outputs = [stderr, stdout].filter((item) => item.length > 0).join(' | ')
  return outputs
    ? `${commandLine}: ${outputs}`
    : `${commandLine}: ${params.causeMessage || 'command failed'}`
}

export async function runLocalOpenClawCli(args: string[]): Promise<{
  stdout: string
  stderr: string
}> {
  const cliCandidates = createOpenClawCliCandidates()
  const cliEnv = createLocalCliEnv()
  const attemptedMessages: string[] = []

  for (const candidate of cliCandidates) {
    const finalArgs = [...candidate.argsPrefix, ...args]
    try {
      const { stdout, stderr } = await execFileAsync(candidate.command, finalArgs, {
        timeout: LOCAL_OPENCLAW_CLI_TIMEOUT_MS,
        windowsHide: true,
        maxBuffer: 256 * 1024,
        env: cliEnv
      })

      return {
        stdout: normalizeCliOutput(stdout),
        stderr: normalizeCliOutput(stderr)
      }
    } catch (error) {
      const errorLike = error as Partial<{
        stdout: string
        stderr: string
        message: string
      }>
      attemptedMessages.push(
        formatCliErrorMessage({
          command: candidate.command,
          args: finalArgs,
          stdout: normalizeCliOutput(errorLike.stdout),
          stderr: normalizeCliOutput(errorLike.stderr),
          causeMessage: normalizeCliOutput(errorLike.message)
        })
      )
    }
  }

  throw new Error(
    `未能执行本地 openclaw CLI。${attemptedMessages.length > 0 ? attemptedMessages.join(' ; ') : ''}`
  )
}
