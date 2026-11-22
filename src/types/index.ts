export type BuiltInCalendarId = 'work' | 'personal' | 'study' | 'health'
export type CalendarId = string
export type RepeatRule = 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly'
export type AppView = 'today' | 'calendar' | 'reminders' | 'import'
export type CalendarView = 'month' | 'week' | 'day' | 'agenda'

export interface ScheduleEvent {
  id: string
  title: string
  start: string
  end: string
  allDay: boolean
  calendar: CalendarId
  location?: string
  notes?: string
  reminder: number
  repeat: RepeatRule
  source?: string
  createdAt: string
}

export interface Reminder {
  id: string
  title: string
  due: string
  notes?: string
  list: CalendarId
  priority: 'none' | 'low' | 'medium' | 'high'
  completed: boolean
  createdAt: string
}

export interface ImportEventPayload {
  title: string
  start: string
  end?: string
  allDay?: boolean
  calendar?: CalendarId
  location?: string
  notes?: string
  reminder?: number
  repeat?: RepeatRule
}

export interface ImportPayload {
  source?: string
  events: ImportEventPayload[]
}

export interface EventOccurrence {
  event: ScheduleEvent
  start: Date
  end: Date
}

export interface CalendarDefinition {
  name: string
  color: string
  soft: string
}

export type CalendarMap = Record<CalendarId, CalendarDefinition>

export function normalizeCalendarColor(hex: string) {
  return /^#[0-9a-f]{6}$/i.test(hex) ? hex.toUpperCase() : '#5E5CE6'
}

export function softCalendarColor(hex: string) {
  const normalized = normalizeCalendarColor(hex)
  const channels = [1, 3, 5].map((index) => parseInt(normalized.slice(index, index + 2), 16))
  return `#${channels.map((channel) => Math.round(channel * 0.14 + 255 * 0.86).toString(16).padStart(2, '0')).join('')}`
}

export function calendarDefinition(name: string, color: string): CalendarDefinition {
  const normalized = normalizeCalendarColor(color)
  return { name, color: normalized, soft: softCalendarColor(normalized) }
}

export function calendarContrastColor(hex: string) {
  const channels = [1, 3, 5].map((index) => parseInt(normalizeCalendarColor(hex).slice(index, index + 2), 16) / 255)
  const [red, green, blue] = channels.map((channel) => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4)
  const luminance = 0.2126 * red + 0.7152 * green + 0.0722 * blue
  const whiteContrast = 1.05 / (luminance + 0.05)
  const darkContrast = (luminance + 0.05) / 0.061
  return whiteContrast >= darkContrast ? '#FFFFFF' : '#1D1D1F'
}

// Apple-inspired indigo, pink, cyan and orange — distinct from the original palette.
export const DEFAULT_CALENDARS: CalendarMap = {
  work: calendarDefinition('工作', '#5E5CE6'),
  personal: calendarDefinition('个人', '#FF375F'),
  study: calendarDefinition('学习', '#32ADE6'),
  health: calendarDefinition('健康', '#FF9F0A'),
}
