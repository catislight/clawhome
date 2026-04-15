/**
 * Gateway 方法契约总表（单一事实来源）。
 *
 * 维护原则：
 * 1. 任何新增/变更网关方法，先改这里，再改具体业务 API。
 * 2. params 写“调用侧可接受的联合形态”，兼容细节放到 compat adapter 处理。
 * 3. payload 先保持 unknown，交给 feature parser 做强校验（防止耦合到单一版本）。
 *
 * 说明：
 * - 这里描述的是“前端调用契约”，不是后端 schema 的逐字段镜像。
 * - 对历史版本存在字段别名（如 sessionKey/key、id/jobId）的接口，
 *   在此处显式保留联合字段，便于类型层面感知兼容面。
 */
export type GatewayMethodMap = {
  // 聊天/会话流：subscribe、history、send 使用会话标识。
  'chat.subscribe': {
    params: {
      sessionKey: string
      key?: string
    }
    payload: unknown
  }
  'chat.history': {
    params: {
      sessionKey: string
      key?: string
      limit?: number
    }
    payload: unknown
  }
  'chat.send': {
    params: {
      sessionKey: string
      key?: string
      message: string
      deliver?: boolean
      idempotencyKey?: string
    }
    payload: unknown
  }
  // 会话管理：列表、重命名、删除、重置。
  'sessions.list': {
    params: {
      includeGlobal?: boolean
      includeUnknown?: boolean
      includeDerivedTitles?: boolean
      includeLastMessage?: boolean
      limit?: number
      agentId?: string
    }
    payload: unknown
  }
  'sessions.patch': {
    params: {
      key: string
      sessionKey?: string
      label?: string
      model?: string | null
    }
    payload: unknown
  }
  'sessions.delete': {
    params: {
      key: string
      sessionKey?: string
    }
    payload: unknown
  }
  'sessions.reset': {
    params: {
      key: string
      sessionKey?: string
      reason?: string
    }
    payload: unknown
  }
  // 定时任务：创建/更新/运行/日志查询。
  'cron.status': {
    params: Record<string, never>
    payload: unknown
  }
  'cron.list': {
    params: {
      includeDisabled?: boolean
    }
    payload: unknown
  }
  'cron.add': {
    params: Record<string, unknown>
    payload: unknown
  }
  'cron.update': {
    params: {
      id?: string
      jobId?: string
      patch: Record<string, unknown>
    }
    payload: unknown
  }
  'cron.remove': {
    params: {
      id?: string
      jobId?: string
    }
    payload: unknown
  }
  'cron.run': {
    params: {
      id?: string
      jobId?: string
      mode?: string
    }
    payload: unknown
  }
  'cron.runs': {
    params: {
      id?: string
      jobId?: string
      limit?: number
      offset?: number
      sortDir?: 'asc' | 'desc'
    }
    payload: unknown
  }
  // 智能体与文件编辑相关接口。
  'agents.list': {
    params: Record<string, never>
    payload: unknown
  }
  'agents.create': {
    params: Record<string, unknown>
    payload: unknown
  }
  'agents.update': {
    params: Record<string, unknown>
    payload: unknown
  }
  'agents.files.list': {
    params: {
      agentId: string
    }
    payload: unknown
  }
  'agents.files.get': {
    params: {
      agentId: string
      name: string
    }
    payload: unknown
  }
  'agents.files.set': {
    params: {
      agentId: string
      name: string
      content: string
    }
    payload: unknown
  }
  // 模型与配置接口。
  'models.list': {
    params: Record<string, never>
    payload: unknown
  }
  'config.get': {
    params: Record<string, never>
    payload: unknown
  }
  'config.set': {
    params: {
      raw: string
      baseHash?: string
    }
    payload: unknown
  }
  // 技能中心接口。
  'skills.status': {
    params: {
      agentId?: string
    }
    payload: unknown
  }
  'skills.update': {
    params: {
      skillKey: string
      enabled: boolean
    }
    payload: unknown
  }
  'tools.catalog': {
    params: {
      agentId?: string
      includePlugins?: boolean
    }
    payload: unknown
  }
}

/**
 * 方法名联合类型：
 * - 用于约束 requestGatewayMethod 的 method 入参
 * - 可避免硬编码字符串造成的拼写错误
 */
export type GatewayMethodName = keyof GatewayMethodMap

/**
 * 根据方法名推导参数类型。
 */
export type GatewayMethodParams<M extends GatewayMethodName> = GatewayMethodMap[M]['params']

/**
 * 根据方法名推导 payload 类型（当前默认 unknown，留给 parser 处理）。
 */
export type GatewayMethodPayload<M extends GatewayMethodName> = GatewayMethodMap[M]['payload']
