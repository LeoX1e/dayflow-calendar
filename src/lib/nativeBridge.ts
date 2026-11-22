type NativeReply = Record<string, unknown>
type PendingRequest = (result: NativeReply) => void

const pendingRequests = new Map<string, PendingRequest>()
let bridgeInstalled = false

export function isNativeMacApp() {
  return typeof window !== 'undefined' && Boolean(window.webkit?.messageHandlers?.dayflow)
}

function installBridge() {
  if (bridgeInstalled || !isNativeMacApp()) return
  bridgeInstalled = true
  window.__dayflowNativeResolve = (id, result) => {
    const resolve = pendingRequests.get(id)
    if (!resolve) return
    pendingRequests.delete(id)
    resolve(result)
  }
}

export function nativeRequest<T extends NativeReply = NativeReply>(type: string, payload: Record<string, unknown> = {}, timeoutMs = 15_000): Promise<T> {
  if (!isNativeMacApp()) return Promise.reject(new Error('当前环境没有 macOS 原生桥接'))
  installBridge()
  const id = `web-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
  return new Promise<T>((resolve, reject) => {
    const timer = timeoutMs > 0 ? window.setTimeout(() => {
      pendingRequests.delete(id)
      reject(new Error(`原生请求超时：${type}`))
    }, timeoutMs) : undefined
    pendingRequests.set(id, (result) => {
      if (timer !== undefined) window.clearTimeout(timer)
      resolve(result as T)
    })
    try {
      window.webkit?.messageHandlers?.dayflow?.postMessage({ id, type, payload })
    } catch (error) {
      if (timer !== undefined) window.clearTimeout(timer)
      pendingRequests.delete(id)
      reject(error)
    }
  })
}

function encodeBase64(content: string) {
  const bytes = new TextEncoder().encode(content)
  let binary = ''
  const chunkSize = 0x8000
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize))
  }
  return btoa(binary)
}

export async function saveNativeFile(filename: string, content: string, mimeType: string) {
  const result = await nativeRequest<{ saved?: boolean; error?: string }>('files.save', {
    filename,
    mimeType,
    base64: encodeBase64(content),
  }, 0)
  if (result.error) throw new Error(result.error)
  return Boolean(result.saved)
}
