import type { SshConnectionFormValues } from '@/features/instances/model/ssh-connection'
import {
  deleteLocalCustomSkill as deleteLocalCustomSkillViaBridge,
  executeSshCommand,
  readLocalSkillFile,
  writeLocalSkillFile
} from '@/shared/api/app-api'
import { OPENCLAW_SKILLS_GATEWAY_TIMEOUT_MS } from '@/features/skills/lib/openclaw-skills-constants'
import { requestGatewayMethod } from '@/shared/api/gateway-client'
import type {
  GatewayMethodName,
  GatewayMethodParams,
  GatewayMethodPayload
} from '@/shared/api/gateway-method-map'
import { isLocalOpenClawConnection } from '@/features/instances/lib/openclaw-connection-config'
import {
  buildDeleteCustomSkillCommand,
  buildReadSkillFileCommand,
  buildWriteSkillFileCommand
} from '@/features/skills/lib/openclaw-skill-file-commands'
import { parseOpenClawSkillsStatusReport } from '@/features/skills/lib/openclaw-skills-parsers'
import type {
  OpenClawSkillStatusEntry,
  OpenClawSkillStatusReport
} from '@/features/skills/lib/openclaw-skills-types'
import { translateWithAppLanguage } from '@/shared/i18n/app-i18n'

/**
 * skills.update 成功返回结构（精简版）。
 */
type OpenClawSkillUpdateResult = {
  ok: true
  skillKey: string
}

/**
 * skills 模块允许调用的 gateway 方法范围。
 */
type OpenClawSkillsGatewayMethod = Extract<GatewayMethodName, `skills.${string}`>

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

/**
 * 标准 ok 结构解析，避免业务直接依赖 unknown。
 */
function parseSkillUpdateResult(payload: unknown): OpenClawSkillUpdateResult | null {
  if (!isRecord(payload) || payload.ok !== true || typeof payload.skillKey !== 'string') {
    return null
  }

  return {
    ok: true,
    skillKey: payload.skillKey
  }
}

/**
 * skills 模块统一网关调用入口：
 * - 固定超时
 * - 自动兼容参数别名与 payload 归一
 */
async function requestSkillsPayload<M extends OpenClawSkillsGatewayMethod>(
  instanceId: string,
  method: M,
  params: GatewayMethodParams<M>
): Promise<GatewayMethodPayload<M>> {
  return await requestGatewayMethod(instanceId, method, params, {
    timeoutMs: OPENCLAW_SKILLS_GATEWAY_TIMEOUT_MS
  })
}

function resolveSshErrorMessage(params: {
  message: string
  stderr: string
  fallback: string
}): string {
  const stderrMessage = params.stderr.trim()
  if (stderrMessage) {
    return stderrMessage
  }

  const normalizedMessage = params.message.trim()
  if (normalizedMessage) {
    return normalizedMessage
  }

  return params.fallback
}

export async function listOpenClawSkills(
  instanceId: string,
  options?: { agentId?: string }
): Promise<OpenClawSkillStatusReport> {
  const payload = await requestSkillsPayload(instanceId, 'skills.status', {
    ...(options?.agentId ? { agentId: options.agentId } : {})
  })
  const result = parseOpenClawSkillsStatusReport(payload)
  if (!result) {
    throw new Error(translateWithAppLanguage('skills.error.api.statusInvalidPayload'))
  }

  return result
}

export async function updateOpenClawSkillEnabled(
  instanceId: string,
  skillKey: string,
  enabled: boolean
): Promise<void> {
  const payload = await requestSkillsPayload(instanceId, 'skills.update', {
    skillKey,
    enabled
  })
  const result = parseSkillUpdateResult(payload)
  if (!result) {
    throw new Error(translateWithAppLanguage('skills.error.api.updateInvalidPayload'))
  }
}

export async function getOpenClawSkillFileContent(
  connection: SshConnectionFormValues,
  filePath: string
): Promise<string> {
  // 本地连接优先走 Electron bridge，避免不必要的 SSH 开销。
  if (isLocalOpenClawConnection(connection)) {
    const result = await readLocalSkillFile({
      filePath
    })

    if (!result.success) {
      throw new Error(result.message || translateWithAppLanguage('skills.error.api.localReadFailed'))
    }

    return result.content
  }

  const result = await executeSshCommand({
    ...connection,
    command: buildReadSkillFileCommand(filePath)
  })

  if (!result.success) {
    throw new Error(
      resolveSshErrorMessage({
        message: result.message,
        stderr: result.stderr,
        fallback: translateWithAppLanguage('skills.error.api.readFailed')
      })
    )
  }

  return result.stdout
}

export async function setOpenClawSkillFileContent(
  connection: SshConnectionFormValues,
  filePath: string,
  content: string
): Promise<void> {
  // 本地连接直接写文件；远端连接走 SSH 命令。
  if (isLocalOpenClawConnection(connection)) {
    const result = await writeLocalSkillFile({
      filePath,
      content
    })

    if (!result.success) {
      throw new Error(result.message || translateWithAppLanguage('skills.error.api.localSaveFailed'))
    }

    return
  }

  const result = await executeSshCommand({
    ...connection,
    command: buildWriteSkillFileCommand(filePath, content)
  })

  if (!result.success) {
    throw new Error(
      resolveSshErrorMessage({
        message: result.message,
        stderr: result.stderr,
        fallback: translateWithAppLanguage('skills.error.api.saveFailed')
      })
    )
  }
}

export async function deleteOpenClawCustomSkill(
  connection: SshConnectionFormValues,
  skill: Pick<OpenClawSkillStatusEntry, 'baseDir' | 'filePath'>
): Promise<void> {
  // 删除同样区分本地/远端两条通路，保持行为一致。
  if (isLocalOpenClawConnection(connection)) {
    const result = await deleteLocalCustomSkillViaBridge({
      baseDir: skill.baseDir,
      filePath: skill.filePath
    })

    if (!result.success) {
      throw new Error(result.message || translateWithAppLanguage('skills.error.api.localDeleteFailed'))
    }

    return
  }

  const result = await executeSshCommand({
    ...connection,
    command: buildDeleteCustomSkillCommand({
      baseDir: skill.baseDir,
      filePath: skill.filePath
    })
  })

  if (!result.success) {
    throw new Error(
      resolveSshErrorMessage({
        message: result.message,
        stderr: result.stderr,
        fallback: translateWithAppLanguage('skills.error.api.deleteFailed')
      })
    )
  }
}
