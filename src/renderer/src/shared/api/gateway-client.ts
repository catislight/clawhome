import { requestGateway } from '@/shared/api/app-api'
import {
  buildGatewayRequestCandidates,
  getGatewayCapabilities,
  normalizeGatewayPayload
} from '@/shared/api/gateway-capabilities'
import type {
  GatewayMethodName,
  GatewayMethodParams,
  GatewayMethodPayload
} from '@/shared/api/gateway-method-map'

type GatewayMethodRequestOptions = {
  timeoutMs?: number
}

/**
 * 原始网关响应结果（保留 success/message 语义）。
 * 适合调用方需要“自行决定失败处理策略”的场景。
 */
type GatewayMethodResult<M extends GatewayMethodName> = {
  success: boolean
  message: string
  payload?: GatewayMethodPayload<M>
}

/**
 * 统一网关调用（带 success 标志）：
 * 1. 先取当前实例的 capability
 * 2. 基于方法和 capability 生成参数候选
 * 3. 顺序尝试候选并自动兼容重试
 * 4. 成功后归一化 payload 结构
 *
 * 该函数不会把 response.success=false 自动抛错，便于上层自定义处理。
 */
export async function requestGatewayMethodResult<M extends GatewayMethodName>(
  instanceId: string,
  method: M,
  params: GatewayMethodParams<M>,
  options?: GatewayMethodRequestOptions
): Promise<GatewayMethodResult<M>> {
  const capabilities = await getGatewayCapabilities(instanceId)
  const requestCandidates = buildGatewayRequestCandidates({
    method,
    params,
    capabilities
  })

  let lastFailedResult: GatewayMethodResult<M> | null = null
  let lastThrownError: unknown = null

  for (const candidateParams of requestCandidates) {
    try {
      // 单次底层请求：method 固定，params 取当前候选。
      const response = await requestGateway({
        instanceId,
        method,
        params: candidateParams,
        timeoutMs: options?.timeoutMs
      })

      if (!response.success) {
        // 记录最后一次失败结果，继续尝试下一个兼容候选。
        lastFailedResult = {
          success: false,
          message: response.message
        }
        continue
      }

      return {
        success: true,
        message: response.message,
        // 返回前统一做 payload 归一化，降低 parser 对后端版本细节的感知。
        payload: normalizeGatewayPayload({
          method,
          payload: response.payload
        }) as GatewayMethodPayload<M>
      }
    } catch (error) {
      lastThrownError = error
    }
  }

  if (lastFailedResult) {
    return lastFailedResult
  }

  if (lastThrownError instanceof Error) {
    throw lastThrownError
  }

  throw new Error(`Gateway 请求失败：${method}`)
}

/**
 * 统一网关调用（抛错版）：
 * - success=false 直接抛错
 * - 适合业务 API 封装层使用（让调用方只关注成功 payload）
 */
export async function requestGatewayMethod<M extends GatewayMethodName>(
  instanceId: string,
  method: M,
  params: GatewayMethodParams<M>,
  options?: GatewayMethodRequestOptions
): Promise<GatewayMethodPayload<M>> {
  const response = await requestGatewayMethodResult(instanceId, method, params, options)

  if (!response.success) {
    throw new Error(response.message || `请求失败：${method}`)
  }

  return response.payload as GatewayMethodPayload<M>
}
