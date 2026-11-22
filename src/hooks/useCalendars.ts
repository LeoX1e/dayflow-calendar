import { createContext, useContext } from 'react'
import { DEFAULT_CALENDARS } from '@/types'
import type { CalendarMap } from '@/types'

export const CalendarsContext = createContext<CalendarMap>(DEFAULT_CALENDARS)

export function useCalendars() {
  return useContext(CalendarsContext)
}
