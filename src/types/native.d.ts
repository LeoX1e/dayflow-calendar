export {}

declare global {
  interface Window {
    webkit?: {
      messageHandlers?: {
        dayflow?: {
          postMessage: (message: unknown) => void
        }
      }
    }
    __dayflowNativeResolve?: (id: string, result: Record<string, unknown>) => void
  }
}
