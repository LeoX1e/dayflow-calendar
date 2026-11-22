import { isNativeMacApp, nativeRequest } from '@/lib/nativeBridge'
import type { NativeNotificationItem } from '@/lib/notificationPlan'

export interface NativeNotificationAction {
  action: 'open' | 'complete'
  kind: 'event' | 'reminder'
  entityId: string
  occurrenceStart?: string
}

export { isNativeMacApp }

export async function getNativeNotificationPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (!isNativeMacApp()) return 'unsupported'
  try {
    const result = await nativeRequest<{ permission?: NotificationPermission }>('notifications.getPermission')
    return result.permission || 'default'
  } catch {
    return 'unsupported'
  }
}

export async function requestNativeNotificationPermission() {
  if (!isNativeMacApp()) return 'unsupported' as const
  try {
    const result = await nativeRequest<{ permission?: NotificationPermission }>('notifications.requestPermission', {}, 120_000)
    return result.permission || 'default'
  } catch {
    return 'unsupported' as const
  }
}

let reconcileRevision = 0
let reconcileQueue: Promise<boolean> = Promise.resolve(false)

export function reconcileNativeNotifications(items: NativeNotificationItem[]) {
  if (!isNativeMacApp()) return Promise.resolve(false)
  const revision = ++reconcileRevision
  reconcileQueue = reconcileQueue.catch(() => false).then(async () => {
    if (revision !== reconcileRevision) return false
    try {
      const result = await nativeRequest<{ status?: string }>('notifications.reconcile', { items })
      return result.status === 'scheduled'
    } catch {
      return false
    }
  })
  return reconcileQueue
}

export async function sendNativeTestNotification() {
  if (!isNativeMacApp()) return false
  try {
    const result = await nativeRequest<{ status?: string }>('notifications.test')
    return result.status === 'scheduled'
  } catch {
    return false
  }
}

export async function openNativeNotificationSettings() {
  if (!isNativeMacApp()) return false
  try {
    const result = await nativeRequest<{ status?: string }>('notifications.openSettings')
    return result.status === 'opened'
  } catch {
    return false
  }
}

export function subscribeNativeNotificationActions(listener: (action: NativeNotificationAction) => void) {
  if (!isNativeMacApp()) return () => undefined
  const handler = (event: Event) => {
    const action = (event as CustomEvent<NativeNotificationAction>).detail
    if (action?.entityId && action.kind && action.action) listener(action)
  }
  window.addEventListener('dayflow:native-action', handler)
  return () => window.removeEventListener('dayflow:native-action', handler)
}

export function notifyNativeReady() {
  if (isNativeMacApp()) void nativeRequest('app.ready').catch(() => undefined)
}
