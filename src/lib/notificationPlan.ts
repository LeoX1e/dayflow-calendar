import type { CalendarMap, Reminder, ScheduleEvent } from '@/types'
import { addDays, eventsForDay, formatTime, startOfDay } from '@/lib/schedule'

export const MAX_NATIVE_NOTIFICATIONS = 48

export interface NativeNotificationItem {
  requestId: string
  kind: 'event' | 'reminder'
  entityId: string
  title: string
  body: string
  fireAt: number
  occurrenceStart?: string
}

function validDate(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

export function buildNativeNotificationPlan(
  events: ScheduleEvent[],
  reminders: Reminder[],
  calendars: CalendarMap,
  now = new Date(),
): NativeNotificationItem[] {
  const items: NativeNotificationItem[] = []
  const requestIds = new Set<string>()
  const nowTime = now.getTime()

  function add(item: NativeNotificationItem) {
    if (!Number.isFinite(item.fireAt) || item.fireAt <= nowTime || requestIds.has(item.requestId)) return
    requestIds.add(item.requestId)
    items.push(item)
  }

  events.forEach((event) => {
    if (!Number.isFinite(event.reminder) || event.reminder < 0 || event.reminder > 1_440) return
    const calendarName = calendars[event.calendar]?.name || '日程'
    const location = event.location?.trim() ? ` · ${event.location.trim()}` : ''

    if (event.repeat === 'none') {
      const start = validDate(event.start)
      if (!start) return
      add({
        requestId: `event.${event.id}.${start.getTime()}`,
        kind: 'event',
        entityId: event.id,
        title: event.title,
        body: `${event.allDay ? '全天' : formatTime(start)} 开始 · ${calendarName}${location}`,
        fireAt: start.getTime() - event.reminder * 60_000,
        occurrenceStart: event.start,
      })
      return
    }

    const lookBehindDays = Math.max(1, Math.ceil(event.reminder / 1_440) + 1)
    const firstDay = addDays(startOfDay(now), -lookBehindDays)
    for (let offset = 0; offset < lookBehindDays + 370; offset += 1) {
      const day = addDays(firstDay, offset)
      eventsForDay([event], day).forEach(({ start }) => {
        const occurrenceStart = new Date(start)
        add({
          requestId: `event.${event.id}.${occurrenceStart.getTime()}`,
          kind: 'event',
          entityId: event.id,
          title: event.title,
          body: `${event.allDay ? '全天' : formatTime(occurrenceStart)} 开始 · ${calendarName}${location}`,
          fireAt: occurrenceStart.getTime() - event.reminder * 60_000,
          occurrenceStart: occurrenceStart.toISOString(),
        })
      })
    }
  })

  reminders.forEach((task) => {
    if (task.completed) return
    const due = validDate(task.due)
    if (!due) return
    const calendarName = calendars[task.list]?.name || '清单'
    add({
      requestId: `reminder.${task.id}.${due.getTime()}`,
      kind: 'reminder',
      entityId: task.id,
      title: task.title,
      body: `提醒事项到期了 · ${calendarName}`,
      fireAt: due.getTime(),
    })
  })

  return items.sort((a, b) => a.fireAt - b.fireAt).slice(0, MAX_NATIVE_NOTIFICATIONS)
}
