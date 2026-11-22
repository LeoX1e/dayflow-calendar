import ICAL from 'ical.js'
import type { CalendarId, CalendarMap, EventOccurrence, ImportEventPayload, ImportPayload, Reminder, RepeatRule, ScheduleEvent } from '@/types'
import { isNativeMacApp, saveNativeFile } from '@/lib/nativeBridge'

export const DAY_MS = 86_400_000

export function localISO(date: Date) {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function dateKey(date: Date | string) {
  const value = typeof date === 'string' ? new Date(date) : date
  return localISO(value).slice(0, 10)
}

export function atTime(base: Date, hour: number, minute = 0) {
  const date = new Date(base)
  date.setHours(hour, minute, 0, 0)
  return localISO(date)
}

export function addDays(date: Date, amount: number) {
  const next = new Date(date)
  next.setDate(next.getDate() + amount)
  return next
}

export function startOfDay(date: Date) {
  const next = new Date(date)
  next.setHours(0, 0, 0, 0)
  return next
}

export function isSameDay(a: Date | string, b: Date | string) {
  return dateKey(a) === dateKey(b)
}

export function createInitialEvents(): ScheduleEvent[] {
  const now = new Date()
  const today = startOfDay(now)
  const createdAt = new Date().toISOString()
  return [
    {
      id: 'welcome-design-review', title: '产品设计评审', start: atTime(today, 10), end: atTime(today, 11),
      allDay: false, calendar: 'work', location: '设计工作室', notes: '确认首版界面与交互流程', reminder: 15, repeat: 'none', createdAt,
    },
    {
      id: 'welcome-agent-sync', title: 'Agent 接入方案同步', start: atTime(today, 14), end: atTime(today, 15),
      allDay: false, calendar: 'work', location: '线上会议', notes: '统一 JSON 与日历文件导入格式', reminder: 15, repeat: 'none', createdAt,
    },
    {
      id: 'welcome-run', title: '晚间慢跑', start: atTime(today, 19, 30), end: atTime(today, 20, 15),
      allDay: false, calendar: 'health', location: '滨江步道', reminder: 30, repeat: 'none', createdAt,
    },
    {
      id: 'welcome-reading', title: '阅读《设计中的设计》', start: atTime(addDays(today, 1), 20), end: atTime(addDays(today, 1), 21),
      allDay: false, calendar: 'study', reminder: 15, repeat: 'none', createdAt,
    },
    {
      id: 'welcome-weekly', title: '每周复盘', start: atTime(addDays(today, 3), 16), end: atTime(addDays(today, 3), 17),
      allDay: false, calendar: 'personal', notes: '回顾本周，安排下周最重要的事', reminder: 30, repeat: 'weekly', createdAt,
    },
    {
      id: 'welcome-launch', title: '日程中枢首版发布', start: dateKey(addDays(today, 5)) + 'T09:00', end: dateKey(addDays(today, 5)) + 'T10:00',
      allDay: true, calendar: 'work', reminder: 60, repeat: 'none', createdAt,
    },
  ]
}

export function createInitialReminders(): Reminder[] {
  const today = startOfDay(new Date())
  const createdAt = new Date().toISOString()
  return [
    { id: 'task-feedback', title: '整理产品原型反馈', due: atTime(today, 17, 30), list: 'work', priority: 'high', completed: false, notes: '汇总评审中的关键修改项', createdAt },
    { id: 'task-call', title: '给妈妈回电话', due: atTime(today, 20, 30), list: 'personal', priority: 'none', completed: false, createdAt },
    { id: 'task-flight', title: '预订下周出差的机票', due: atTime(addDays(today, 1), 12), list: 'personal', priority: 'medium', completed: false, createdAt },
    { id: 'task-stretch', title: '晨间拉伸 15 分钟', due: atTime(today, 8), list: 'health', priority: 'none', completed: true, createdAt },
  ]
}

function occursOn(event: ScheduleEvent, day: Date) {
  const start = new Date(event.start)
  const target = startOfDay(day)
  const first = startOfDay(start)
  if (target < first) return false
  const days = Math.round((target.getTime() - first.getTime()) / DAY_MS)
  switch (event.repeat) {
    case 'daily': return true
    case 'weekly': return days % 7 === 0
    case 'monthly': return target.getDate() === first.getDate()
    case 'yearly': return target.getDate() === first.getDate() && target.getMonth() === first.getMonth()
    default: return isSameDay(start, target) || (new Date(event.end) > target && start < addDays(target, 1))
  }
}

export function eventsForDay(events: ScheduleEvent[], day: Date): EventOccurrence[] {
  const result: EventOccurrence[] = []
  for (const event of events) {
    if (!occursOn(event, day)) continue
    const originalStart = new Date(event.start)
    const originalEnd = new Date(event.end)
    const start = new Date(day)
    start.setHours(originalStart.getHours(), originalStart.getMinutes(), 0, 0)
    const duration = Math.max(originalEnd.getTime() - originalStart.getTime(), 30 * 60_000)
    const end = new Date(start.getTime() + duration)
    if (event.repeat === 'none') {
      result.push({ event, start: originalStart, end: originalEnd })
    } else {
      result.push({ event, start, end })
    }
  }
  return result.sort((a, b) => Number(a.event.allDay === false) - Number(b.event.allDay === false) || a.start.getTime() - b.start.getTime())
}

export function monthGrid(date: Date) {
  const first = new Date(date.getFullYear(), date.getMonth(), 1)
  const mondayOffset = (first.getDay() + 6) % 7
  const start = addDays(first, -mondayOffset)
  return Array.from({ length: 42 }, (_, index) => addDays(start, index))
}

export function weekDays(date: Date) {
  const monday = addDays(date, -((date.getDay() + 6) % 7))
  return Array.from({ length: 7 }, (_, index) => addDays(monday, index))
}

export function formatTime(date: Date | string) {
  return new Intl.DateTimeFormat('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(date))
}

export function formatFullDate(date: Date | string) {
  return new Intl.DateTimeFormat('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' }).format(new Date(date))
}

export function formatMonth(date: Date) {
  return new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: 'long' }).format(date)
}

export function formatSmartDate(date: Date | string) {
  const value = new Date(date)
  const today = startOfDay(new Date())
  if (isSameDay(value, today)) return `今天 ${formatTime(value)}`
  if (isSameDay(value, addDays(today, 1))) return `明天 ${formatTime(value)}`
  return new Intl.DateTimeFormat('zh-CN', { month: 'numeric', day: 'numeric', weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false }).format(value)
}

export function hasConflict(candidate: ImportEventPayload, events: ScheduleEvent[]) {
  const start = new Date(candidate.start).getTime()
  const end = new Date(candidate.end || new Date(new Date(candidate.start).getTime() + 3600000)).getTime()
  return events.some((event) => {
    if (event.allDay || candidate.allDay) return false
    const eventStart = new Date(event.start).getTime()
    const eventEnd = new Date(event.end).getTime()
    return start < eventEnd && end > eventStart
  })
}

export function isDuplicate(candidate: ImportEventPayload, events: ScheduleEvent[]) {
  const start = new Date(candidate.start).getTime()
  return events.some((event) => event.title.trim() === candidate.title.trim() && new Date(event.start).getTime() === start)
}

export function normalizeImport(payload: ImportPayload, calendars: CalendarMap): ImportEventPayload[] {
  if (!payload || !Array.isArray(payload.events)) throw new Error('内容中缺少 events 数组')
  return payload.events.map((item, index) => {
    if (!item.title?.trim()) throw new Error(`第 ${index + 1} 项缺少标题`)
    if (!item.start || Number.isNaN(new Date(item.start).getTime())) throw new Error(`第 ${index + 1} 项的开始时间无效`)
    const start = new Date(item.start)
    const end = item.end ? new Date(item.end) : new Date(start.getTime() + 3600000)
    if (Number.isNaN(end.getTime()) || end <= start) throw new Error(`第 ${index + 1} 项的结束时间无效`)
    const reminder = item.reminder ?? 15
    if (!Number.isFinite(reminder) || reminder < -1 || reminder > 1_440) throw new Error(`第 ${index + 1} 项的提醒时间无效`)
    return {
      ...item,
      title: item.title.trim(),
      start: localISO(start),
      end: localISO(end),
      calendar: item.calendar && Object.hasOwn(calendars, item.calendar) ? item.calendar : 'work',
      reminder,
      repeat: item.repeat || 'none',
    }
  })
}

export function toScheduleEvent(item: ImportEventPayload, source = 'AI 导入'): ScheduleEvent {
  return {
    id: crypto.randomUUID(), title: item.title, start: item.start, end: item.end || localISO(new Date(new Date(item.start).getTime() + 3600000)),
    allDay: Boolean(item.allDay), calendar: item.calendar || 'work', location: item.location, notes: item.notes,
    reminder: item.reminder ?? 15, repeat: item.repeat || 'none', source, createdAt: new Date().toISOString(),
  }
}

export function encodeImportLink(payload: ImportPayload) {
  const bytes = new TextEncoder().encode(JSON.stringify(payload))
  let binary = ''
  bytes.forEach((byte) => { binary += String.fromCharCode(byte) })
  const encoded = btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '')
  return `${window.location.origin}${window.location.pathname}?import=${encoded}`
}

export function decodeImportLink(value: string): ImportPayload {
  const normalized = value.replaceAll('-', '+').replaceAll('_', '/')
  const binary = atob(normalized)
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0))
  return JSON.parse(new TextDecoder().decode(bytes)) as ImportPayload
}

export function parseICS(text: string): ImportEventPayload[] {
  const calendar = new ICAL.Component(ICAL.parse(text))
  const items = calendar.getAllSubcomponents('vevent')
  if (!items.length) throw new Error('文件中没有可导入的日程')
  return items.map((component) => {
    const event = new ICAL.Event(component)
    const recur = component.getFirstPropertyValue('rrule') as ICAL.Recur | null
    const freq = recur?.freq?.toLowerCase() as RepeatRule | undefined
    return {
      title: event.summary || '无标题日程',
      start: localISO(event.startDate.toJSDate()),
      end: localISO(event.endDate.toJSDate()),
      allDay: event.startDate.isDate,
      location: event.location || undefined,
      notes: event.description || undefined,
      calendar: 'work',
      reminder: 15,
      repeat: freq && ['daily', 'weekly', 'monthly', 'yearly'].includes(freq) ? freq : 'none',
    }
  })
}

export function exportICS(events: ScheduleEvent[]) {
  const calendar = new ICAL.Component(['vcalendar', [], []])
  calendar.updatePropertyWithValue('prodid', '-//Dayflow//Schedule Hub//ZH')
  calendar.updatePropertyWithValue('version', '2.0')
  calendar.updatePropertyWithValue('calscale', 'GREGORIAN')
  events.forEach((item) => {
    const component = new ICAL.Component('vevent')
    component.updatePropertyWithValue('uid', item.id)
    component.updatePropertyWithValue('dtstamp', ICAL.Time.fromJSDate(new Date()))
    component.updatePropertyWithValue('dtstart', ICAL.Time.fromJSDate(new Date(item.start)))
    component.updatePropertyWithValue('dtend', ICAL.Time.fromJSDate(new Date(item.end)))
    component.updatePropertyWithValue('summary', item.title)
    if (item.location) component.updatePropertyWithValue('location', item.location)
    if (item.notes) component.updatePropertyWithValue('description', item.notes)
    if (item.repeat !== 'none') component.updatePropertyWithValue('rrule', new ICAL.Recur({ freq: item.repeat.toUpperCase() }))
    calendar.addSubcomponent(component)
  })
  return calendar.toString()
}

export async function downloadFile(content: string, filename: string, type: string): Promise<boolean> {
  if (isNativeMacApp()) return saveNativeFile(filename, content, type)
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  return true
}

export const SAMPLE_IMPORT: ImportPayload = {
  source: 'Kimi',
  events: [
    { title: 'AI 产品头脑风暴', start: atTime(addDays(new Date(), 2), 10), end: atTime(addDays(new Date(), 2), 11, 30), calendar: 'work', location: '会议室 A', reminder: 15 },
    { title: '整理用户访谈纪要', start: atTime(addDays(new Date(), 2), 15), end: atTime(addDays(new Date(), 2), 16), calendar: 'study', reminder: 30 },
    { title: '瑜伽课', start: atTime(addDays(new Date(), 3), 19), end: atTime(addDays(new Date(), 3), 20), calendar: 'health', location: ' Wellness Studio ', reminder: 60 },
  ],
}

export function createAgentPrompt(calendars: CalendarMap) {
  const options = Object.entries(calendars).map(([id, item]) => `${id}（${item.name}）`).join(' / ')
  return `请把接下来安排的日程整理为“日程中枢”可导入的 JSON，只输出 JSON，不要添加 Markdown：\n{\n  "source": "你的 AI 名称",\n  "events": [{\n    "title": "日程标题",\n    "start": "2026-11-23T10:00",\n    "end": "2026-11-23T11:00",\n    "calendar": "work",\n    "location": "可选地点",\n    "notes": "可选备注",\n    "reminder": 15,\n    "repeat": "none"\n  }]\n}\ncalendar 可选 ${options}；repeat 可选 none / daily / weekly / monthly / yearly。时间使用本地 ISO 格式。`
}

export function isCalendarId(value: string): value is CalendarId {
  return /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/.test(value) && !['constructor', 'prototype', '__proto__'].includes(value)
}
