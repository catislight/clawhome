import { requestGatewayMethod } from '@/shared/api/gateway-client'
import type {
  GatewayMethodName,
  GatewayMethodParams,
  GatewayMethodPayload
} from '@/shared/api/gateway-method-map'
import {
  OPENCLAW_CRON_DEFAULT_SESSION_MESSAGES_LIMIT,
  OPENCLAW_CRON_GATEWAY_TIMEOUT_MS,
  OPENCLAW_CRON_OUTPUT_PROBE_MESSAGES_LIMIT
} from '@/features/cron/lib/openclaw-cron-constants'
import {
  parseOpenClawCronHistoryMessages,
  parseOpenClawCronJob,
  parseOpenClawCronListPayload,
  parseOpenClawCronRunsPage,
  parseOpenClawCronSchedulerStatus
} from '@/features/cron/lib/openclaw-cron-parsers'
import type {
  OpenClawCronJob,
  OpenClawCronRunLogSortDir,
  OpenClawCronRunsPage,
  OpenClawCronSchedulerStatus
} from '@/features/cron/lib/openclaw-cron-types'
import type { ConversationMessage } from '@/shared/contracts/chat-conversation'
import { buildOpenClawCronSessionKey } from '@/features/cron/lib/openclaw-cron-session'
import { translateWithAppLanguage } from '@/shared/i18n/app-i18n'

/**
 * cron 业务层可直接透传给网关的可变结构。
 * 具体字段约束由表单构建器和后端校验共同保证。
 */
type OpenClawCronMutationPayload = Record<string, unknown>

/**
 * 限定当前模块允许调用的方法，避免误用其它域方法。
 */
type OpenClawCronGatewayMethod = Extract<GatewayMethodName, `cron.${string}` | 'chat.history'>

/**
 * cron 模块统一请求入口：
 * - 固定 20s 超时
 * - 复用 typed gateway client（含能力兼容与 payload 归一）
 */
async function requestCronPayload<M extends OpenClawCronGatewayMethod>(
  instanceId: string,
  method: M,
  params: GatewayMethodParams<M>
): Promise<GatewayMethodPayload<M>> {
  return await requestGatewayMethod(instanceId, method, params, {
    timeoutMs: OPENCLAW_CRON_GATEWAY_TIMEOUT_MS
  })
}

export async function getOpenClawCronSchedulerStatus(
  instanceId: string
): Promise<OpenClawCronSchedulerStatus> {
  // status 是 cron 页面的基础状态，结构必须可解析，否则直接视为后端返回异常。
  const payload = await requestCronPayload(instanceId, 'cron.status', {})
  const status = parseOpenClawCronSchedulerStatus(payload)

  if (!status) {
    throw new Error(translateWithAppLanguage('cron.error.api.invalidStatusPayload'))
  }

  return status
}

export async function listOpenClawCronJobs(instanceId: string): Promise<OpenClawCronJob[]> {
  // 当前产品默认需要展示禁用任务，所以固定 includeDisabled=true。
  const payload = await requestCronPayload(instanceId, 'cron.list', {
    includeDisabled: true
  })

  return parseOpenClawCronListPayload(payload)
}

export async function createOpenClawCronJob(
  instanceId: string,
  payload: OpenClawCronMutationPayload
): Promise<OpenClawCronJob> {
  const responsePayload = await requestCronPayload(instanceId, 'cron.add', payload)
  const job = parseOpenClawCronJob(responsePayload)

  if (!job) {
    throw new Error(translateWithAppLanguage('cron.error.api.invalidAddPayload'))
  }

  return job
}

export async function updateOpenClawCronJob(
  instanceId: string,
  jobId: string,
  patch: OpenClawCronMutationPayload
): Promise<OpenClawCronJob> {
  const responsePayload = await requestCronPayload(instanceId, 'cron.update', {
    id: jobId,
    patch
  })
  const job = parseOpenClawCronJob(responsePayload)

  if (!job) {
    throw new Error(translateWithAppLanguage('cron.error.api.invalidUpdatePayload'))
  }

  return job
}

export async function removeOpenClawCronJob(instanceId: string, jobId: string): Promise<void> {
  await requestCronPayload(instanceId, 'cron.remove', {
    id: jobId
  })
}

export async function runOpenClawCronJob(instanceId: string, jobId: string): Promise<void> {
  // 手动运行统一使用 force 模式，避免受调度时间窗口影响。
  await requestCronPayload(instanceId, 'cron.run', {
    id: jobId,
    mode: 'force'
  })
}

export async function listOpenClawCronRuns(
  instanceId: string,
  params: {
    jobId: string
    limit?: number
    offset?: number
    sortDir?: OpenClawCronRunLogSortDir
  }
): Promise<OpenClawCronRunsPage> {
  // 列表统一按时间倒序，保证 UI 可直接展示“最新执行在最上方”。
  const payload = await requestCronPayload(instanceId, 'cron.runs', {
    id: params.jobId,
    limit: params.limit,
    offset: params.offset,
    sortDir: params.sortDir ?? 'desc'
  })
  const page = parseOpenClawCronRunsPage(payload)

  if (!page) {
    throw new Error(translateWithAppLanguage('cron.error.api.invalidRunsPayload'))
  }

  return page
}

export async function listOpenClawCronSessionMessages(
  instanceId: string,
  sessionKey: string,
  limit: number = OPENCLAW_CRON_DEFAULT_SESSION_MESSAGES_LIMIT
): Promise<ConversationMessage[]> {
  // 这里只取 assistant 文本输出，隐藏用户输入和空内容，匹配“只读输出面板”需求。
  const payload = await requestCronPayload(instanceId, 'chat.history', {
    sessionKey,
    limit
  })
  const messages = parseOpenClawCronHistoryMessages(payload)

  return messages.filter(
    (message) => message.role === 'assistant' && message.content.trim().length > 0
  )
}

export async function hasOpenClawCronJobOutput(
  instanceId: string,
  jobId: string
): Promise<boolean> {
  // 只做轻量探测：取少量 history 判断“最近是否有输出”。
  const messages = await listOpenClawCronSessionMessages(
    instanceId,
    buildOpenClawCronSessionKey(jobId),
    OPENCLAW_CRON_OUTPUT_PROBE_MESSAGES_LIMIT
  )

  return messages.length > 0
}
