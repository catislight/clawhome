import net from 'node:net'

import type { NodeSSH } from 'node-ssh'

export const DEFAULT_GATEWAY_HOST = '127.0.0.1'
export const DEFAULT_GATEWAY_PORT = 18789
export const DEFAULT_GATEWAY_PATH = '/'

export type GatewayErrorShape = {
  code?: string
  message?: string
  details?: unknown
  retryable?: boolean
  retryAfterMs?: number
}

export type GatewayRequestFrame = {
  type: 'req'
  id: string
  method: string
  params?: unknown
}

type GatewayResponseFrame = {
  type: 'res'
  id: string
  ok: boolean
  payload?: unknown
  error?: GatewayErrorShape
}

type GatewayEventFrame = {
  type: 'event'
  event: string
  payload?: unknown
  seq?: number
  stateVersion?: unknown
}

export type GatewayFrame = GatewayRequestFrame | GatewayResponseFrame | GatewayEventFrame

export function buildGatewayWsUrl(
  port: number,
  rawPath: string | undefined,
  rawHost = '127.0.0.1'
): string {
  const host = rawHost.trim() || '127.0.0.1'
  const trimmedPath = (rawPath ?? DEFAULT_GATEWAY_PATH).trim()
  if (trimmedPath.length === 0 || trimmedPath === '/') {
    return `ws://${host}:${port}`
  }
  if (trimmedPath.startsWith('/')) {
    return `ws://${host}:${port}${trimmedPath}`
  }
  return `ws://${host}:${port}/${trimmedPath}`
}

export function buildGatewayOrigin(
  rawOrigin: string | undefined,
  remoteGatewayPort: number
): string {
  const trimmed = (rawOrigin ?? '').trim()
  if (trimmed.length > 0) {
    return trimmed
  }
  return `http://localhost:${remoteGatewayPort || DEFAULT_GATEWAY_PORT}`
}

export function normalizeMessageData(data: unknown): Promise<string | null> {
  if (typeof data === 'string') {
    return Promise.resolve(data)
  }

  if (data instanceof ArrayBuffer) {
    return Promise.resolve(Buffer.from(data).toString('utf8'))
  }

  if (ArrayBuffer.isView(data)) {
    return Promise.resolve(
      Buffer.from(data.buffer, data.byteOffset, data.byteLength).toString('utf8')
    )
  }

  if (typeof Blob !== 'undefined' && data instanceof Blob) {
    return data.text()
  }

  return Promise.resolve(null)
}

export function parseGatewayFrame(raw: string): GatewayFrame | null {
  try {
    const parsed = JSON.parse(raw) as Partial<GatewayFrame> | null
    if (!parsed || typeof parsed !== 'object' || typeof parsed.type !== 'string') {
      return null
    }
    if (parsed.type === 'res' && typeof parsed.id === 'string') {
      return {
        type: 'res',
        id: parsed.id,
        ok: Boolean(parsed.ok),
        payload: parsed.payload,
        error:
          parsed.error && typeof parsed.error === 'object'
            ? (parsed.error as GatewayErrorShape)
            : undefined
      }
    }
    if (parsed.type === 'event' && typeof parsed.event === 'string') {
      return {
        type: 'event',
        event: parsed.event,
        payload: parsed.payload,
        seq: typeof parsed.seq === 'number' ? parsed.seq : undefined,
        stateVersion: parsed.stateVersion
      }
    }
    if (
      parsed.type === 'req' &&
      typeof parsed.id === 'string' &&
      typeof parsed.method === 'string'
    ) {
      return {
        type: 'req',
        id: parsed.id,
        method: parsed.method,
        params: parsed.params
      }
    }
  } catch {
    return null
  }

  return null
}

export async function listenLocalTunnel(
  ssh: NodeSSH,
  remoteHost: string,
  remotePort: number
): Promise<{ server: net.Server; localPort: number }> {
  const server = net.createServer((socket) => {
    socket.on('error', () => {
      // no-op
    })

    const srcIp = socket.remoteAddress?.replace(/^::ffff:/, '') || '127.0.0.1'
    const srcPort = socket.remotePort ?? 0

    void ssh
      .forwardOut(srcIp, srcPort, remoteHost, remotePort)
      .then((channel) => {
        socket.pipe(channel)
        channel.pipe(socket)

        socket.on('error', () => {
          channel.destroy()
        })
        channel.on('error', () => {
          socket.destroy()
        })
      })
      .catch(() => {
        socket.destroy()
      })
  })

  await new Promise<void>((resolve, reject) => {
    const onError = (error: Error): void => {
      server.off('listening', onListening)
      reject(error)
    }
    const onListening = (): void => {
      server.off('error', onError)
      resolve()
    }
    server.once('error', onError)
    server.once('listening', onListening)
    server.listen(0, '127.0.0.1')
  })

  const address = server.address()
  if (!address || typeof address === 'string') {
    server.close()
    throw new Error('Failed to resolve local tunnel address.')
  }

  return {
    server,
    localPort: address.port
  }
}

export async function waitWebSocketOpen(ws: WebSocket, timeoutMs: number): Promise<void> {
  if (ws.readyState === WebSocket.OPEN) {
    return
  }

  await new Promise<void>((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      cleanup()
      reject(new Error(`WebSocket open timeout after ${timeoutMs}ms`))
    }, timeoutMs)

    const handleOpen = (): void => {
      cleanup()
      resolve()
    }

    const handleError = (event: Event): void => {
      cleanup()
      const message =
        event.type === 'error' ? 'Gateway WebSocket failed to open.' : 'WebSocket open failed.'
      reject(new Error(message))
    }

    const cleanup = (): void => {
      clearTimeout(timeoutId)
      ws.removeEventListener('open', handleOpen)
      ws.removeEventListener('error', handleError)
    }

    ws.addEventListener('open', handleOpen)
    ws.addEventListener('error', handleError)
  })
}
