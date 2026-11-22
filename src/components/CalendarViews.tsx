import { useEffect, useState } from 'react'
import { CalendarPlus, Check, ChevronRight, Clock3, MapPin, Plus } from 'lucide-react'
import { calendarContrastColor } from '@/types'
import type { CalendarView, EventOccurrence, Reminder, ScheduleEvent } from '@/types'
import { useCalendars } from '@/hooks/useCalendars'
import { addDays, dateKey, eventsForDay, formatFullDate, formatMonth, formatTime, isSameDay, monthGrid, weekDays } from '@/lib/schedule'

interface ViewProps {
  events: ScheduleEvent[]
  reminders: Reminder[]
  selectedDate: Date
  calendarView: CalendarView
  onSelectDate: (date: Date) => void
  onOpenEvent: (event: ScheduleEvent) => void
  onOpenReminder: (reminder: Reminder) => void
  onCreateEvent: (date?: Date) => void
  onShowDay: (date: Date) => void
  onMoveEvent: (id: string, date: Date) => void
}

const DRAG_TYPE = 'application/x-dayflow-event'

function EventPill({ occurrence, onOpen }: { occurrence: EventOccurrence; onOpen: () => void }) {
  const calendars = useCalendars()
  const { event, start } = occurrence
  const draggable = event.repeat === 'none'
  return (
    <button className="month-event" draggable={draggable} title={draggable ? `${event.title} · 拖拽可改期` : `${event.title} · 重复日程请在编辑中修改`} onDragStart={(e) => { e.dataTransfer.setData(DRAG_TYPE, event.id); e.dataTransfer.effectAllowed = 'move' }} onClick={(e) => { e.stopPropagation(); onOpen() }} style={{ '--event-color': calendars[event.calendar].color, '--event-soft': calendars[event.calendar].soft } as React.CSSProperties}>
      <span className="event-dot" />
      <span className="month-event-time">{event.allDay ? '全天' : formatTime(start)}</span>
      <span className="month-event-title">{event.title}</span>
    </button>
  )
}

function MonthView({ events, selectedDate, onSelectDate, onOpenEvent, onShowDay, onCreateEvent, onMoveEvent }: ViewProps) {
  const calendars = useCalendars()
  const [dragOver, setDragOver] = useState<string | null>(null)
  const days = monthGrid(selectedDate)
  return (
    <div className="month-view">
      <div className="weekday-row">{['一', '二', '三', '四', '五', '六', '日'].map((day, index) => <div key={day} className={index > 4 ? 'weekend' : ''}>周{day}</div>)}</div>
      <div className="month-grid">
        {days.map((day) => {
          const occurrences = eventsForDay(events, day)
          const isToday = isSameDay(day, new Date())
          const isSelected = isSameDay(day, selectedDate)
          const key = dateKey(day)
          return (
            <div key={key} className={`month-cell ${day.getMonth() !== selectedDate.getMonth() ? 'outside' : ''} ${isSelected ? 'selected' : ''} ${dragOver === key ? 'drag-over' : ''}`} onDragOver={(e) => { if (e.dataTransfer.types.includes(DRAG_TYPE)) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDragOver(key) } }} onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragOver(null) }} onDrop={(e) => { e.preventDefault(); const id = e.dataTransfer.getData(DRAG_TYPE); if (id) onMoveEvent(id, day); setDragOver(null) }}>
              <button className={`date-number ${isToday ? 'today' : ''}`} onClick={() => onSelectDate(day)} aria-label={formatFullDate(day)} aria-pressed={isSelected}>
                {day.getDate()}
              </button>
              <button className="cell-add-event" onClick={() => onCreateEvent(day)} aria-label={`${formatFullDate(day)}新建日程`} title="新建日程"><Plus size={14} /></button>
              <div className="month-events">
                {occurrences.slice(0, 4).map((occurrence) => <EventPill key={`${occurrence.event.id}-${key}`} occurrence={occurrence} onOpen={() => onOpenEvent(occurrence.event)} />)}
                {occurrences.length > 4 && <button className="more-events" onClick={() => onShowDay(day)}>还有 {occurrences.length - 4} 项 <ChevronRight size={11} /></button>}
              </div>
              <div className="mobile-event-dots">{occurrences.slice(0, 4).map(({ event }) => <span key={event.id} style={{ background: calendars[event.calendar].color }} />)}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

const TIMELINE_START = 7
const TIMELINE_END = 21
const HOUR_HEIGHT = 64
const TIMELINE_HEIGHT = (TIMELINE_END - TIMELINE_START) * HOUR_HEIGHT
const HOURS = Array.from({ length: TIMELINE_END - TIMELINE_START }, (_, index) => index + TIMELINE_START)

function timelineRange(day: Date, { start, end }: EventOccurrence) {
  const rangeStart = new Date(day)
  rangeStart.setHours(TIMELINE_START, 0, 0, 0)
  const rangeEnd = new Date(day)
  rangeEnd.setHours(TIMELINE_END, 0, 0, 0)
  return { start: +rangeStart, end: +rangeEnd, visibleStart: Math.max(+rangeStart, +start), visibleEnd: Math.min(+rangeEnd, +end) }
}

function isOutsideTimeline(day: Date, occurrence: EventOccurrence) {
  if (occurrence.event.allDay) return false
  const { visibleStart, visibleEnd } = timelineRange(day, occurrence)
  return visibleEnd <= visibleStart
}

function CurrentTimeLine() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000)
    return () => window.clearInterval(timer)
  }, [])
  const currentHour = now.getHours() + now.getMinutes() / 60
  if (currentHour < TIMELINE_START || currentHour >= TIMELINE_END) return null
  return <div className="current-time-line" style={{ top: (currentHour - TIMELINE_START) * HOUR_HEIGHT }}><span /></div>
}

function TimelineColumn({ day, occurrences, onOpenEvent }: { day: Date; occurrences: EventOccurrence[]; onOpenEvent: (event: ScheduleEvent) => void }) {
  const calendars = useCalendars()
  return (
    <div className="timeline-column">
      {HOURS.map((hour) => <div className="timeline-hour-line" key={hour} />)}
      {occurrences.filter(({ event }) => !event.allDay).map((occurrence) => {
        const { event, start, end } = occurrence
        const range = timelineRange(day, occurrence)
        if (range.visibleEnd <= range.visibleStart) return null
        const top = (range.visibleStart - range.start) / 3_600_000 * HOUR_HEIGHT
        const height = Math.max(32, (range.visibleEnd - range.visibleStart) / 3_600_000 * HOUR_HEIGHT)
        const accessibleTop = Math.min(top, TIMELINE_HEIGHT - height)
        const timeLabel = `${formatTime(start)}–${formatTime(end)}`
        return (
          <button key={event.id} className="timeline-event" title={`${event.title} · ${timeLabel}`} aria-label={`${event.title}，${timeLabel}`} onClick={() => onOpenEvent(event)} style={{ top: accessibleTop, height, '--event-color': calendars[event.calendar].color, '--event-soft': calendars[event.calendar].soft } as React.CSSProperties}>
            <strong>{event.title}</strong><span>{timeLabel}</span>
            {height > 60 && event.location && <span className="timeline-location">{event.location}</span>}
          </button>
        )
      })}
      {isSameDay(day, new Date()) && <CurrentTimeLine />}
    </div>
  )
}

function TimeLabels() {
  return <div className="time-labels">{HOURS.map((hour) => <div key={hour}><span>{String(hour).padStart(2, '0')}:00</span></div>)}</div>
}

function WeekView(props: ViewProps) {
  const calendars = useCalendars()
  const days = weekDays(props.selectedDate)
  return (
    <div className="week-view">
      <div className="week-desktop">
        <div className="week-header"><div className="time-gutter" />{days.map((day) => <button key={dateKey(day)} onClick={() => props.onShowDay(day)} className={isSameDay(day, new Date()) ? 'today' : ''}><span>{new Intl.DateTimeFormat('zh-CN', { weekday: 'short' }).format(day)}</span><strong>{day.getDate()}</strong></button>)}</div>
        <div className="all-day-row"><span>全天 / 其他</span>{days.map((day) => <div key={dateKey(day)}>{eventsForDay(props.events, day).filter((occurrence) => occurrence.event.allDay || isOutsideTimeline(day, occurrence)).map((occurrence) => <button key={occurrence.event.id} className={occurrence.event.allDay ? '' : 'outside-timeline-event'} onClick={() => props.onOpenEvent(occurrence.event)} style={{ '--event-color': calendars[occurrence.event.calendar].color, color: calendarContrastColor(calendars[occurrence.event.calendar].color) } as React.CSSProperties}>{occurrence.event.allDay ? occurrence.event.title : `${formatTime(occurrence.start)} ${occurrence.event.title}`}</button>)}</div>)}</div>
        <div className="week-timeline"><TimeLabels />{days.map((day) => <TimelineColumn key={dateKey(day)} day={day} occurrences={eventsForDay(props.events, day)} onOpenEvent={props.onOpenEvent} />)}</div>
      </div>
      <div className="week-mobile"><AgendaList {...props} days={days} /></div>
    </div>
  )
}

function DayView(props: ViewProps) {
  const occurrences = eventsForDay(props.events, props.selectedDate)
  const outside = occurrences.filter((occurrence) => isOutsideTimeline(props.selectedDate, occurrence))
  return (
    <div className="day-view">
      <div className="day-view-heading"><span>{new Intl.DateTimeFormat('zh-CN', { weekday: 'long' }).format(props.selectedDate)}</span><strong>{props.selectedDate.getDate()}</strong><p>{formatMonth(props.selectedDate)}</p></div>
      {occurrences.some(({ event }) => event.allDay) && <div className="day-all-day">{occurrences.filter(({ event }) => event.allDay).map(({ event }) => <button key={event.id} onClick={() => props.onOpenEvent(event)}>{event.title}</button>)}</div>}
      {outside.length > 0 && <div className="day-outside"><span>时间轴外</span><div>{outside.map(({ event, start }) => <button key={event.id} onClick={() => props.onOpenEvent(event)}><Clock3 size={12} />{formatTime(start)} {event.title}</button>)}</div></div>}
      <div className="day-timeline"><TimeLabels /><TimelineColumn day={props.selectedDate} occurrences={occurrences} onOpenEvent={props.onOpenEvent} /></div>
    </div>
  )
}

function AgendaList({ events, selectedDate, onOpenEvent, onCreateEvent, days }: ViewProps & { days?: Date[] }) {
  const calendars = useCalendars()
  const listDays = days || Array.from({ length: 35 }, (_, index) => addDays(selectedDate, index))
  const groups = listDays.map((day) => ({ day, occurrences: eventsForDay(events, day) })).filter((group) => group.occurrences.length)
  if (!groups.length) return <div className="empty-state"><CalendarPlus size={32} /><h3>这段时间没有日程</h3><p>留一点空白，或者添加一件重要的事。</p><button className="primary-button" onClick={() => onCreateEvent(selectedDate)}>新建日程</button></div>
  return <div className="agenda-list">{groups.map(({ day, occurrences }) => <section className="agenda-day" key={dateKey(day)}>
    <div className="agenda-date"><strong>{day.getDate()}</strong><div><span>{new Intl.DateTimeFormat('zh-CN', { weekday: 'long' }).format(day)}</span><small>{formatMonth(day)}{isSameDay(day, new Date()) && ' · 今天'}</small></div></div>
    <div className="agenda-events">{occurrences.map(({ event, start, end }) => <button key={event.id} className="agenda-event" onClick={() => onOpenEvent(event)}>
      <span className="agenda-color" style={{ background: calendars[event.calendar].color }} />
      <div className="agenda-time">{event.allDay ? '全天' : <>{formatTime(start)}<small>{formatTime(end)}</small></>}</div>
      <div className="agenda-copy"><strong>{event.title}</strong><span>{calendars[event.calendar].name}{event.location && ` · ${event.location}`}</span></div><ChevronRight size={16} />
    </button>)}</div>
  </section>)}</div>
}

function AgendaView(props: ViewProps) {
  return <div className="agenda-view"><div className="content-heading compact"><div><h2>接下来</h2><p>从 {formatFullDate(props.selectedDate)} 开始的 35 天</p></div></div><AgendaList {...props} /></div>
}

export function CalendarViews(props: ViewProps) {
  switch (props.calendarView) {
    case 'week': return <WeekView {...props} />
    case 'day': return <DayView {...props} />
    case 'agenda': return <AgendaView {...props} />
    default: return <MonthView {...props} />
  }
}

export function DayInspector({ selectedDate, events, reminders, onOpenEvent, onOpenReminder, onCreateEvent }: ViewProps) {
  const calendars = useCalendars()
  const occurrences = eventsForDay(events, selectedDate)
  const tasks = reminders.filter((task) => isSameDay(task.due, selectedDate))
  return (
    <aside className="day-inspector">
      <div className="inspector-date"><span>{new Intl.DateTimeFormat('zh-CN', { weekday: 'long' }).format(selectedDate)}</span><strong>{selectedDate.getDate()}</strong><p>{formatMonth(selectedDate)}</p></div>
      <div className="inspector-section">
        <div className="inspector-title"><span>日程</span><button onClick={() => onCreateEvent(selectedDate)} aria-label="在这一天新建日程">+</button></div>
        {occurrences.length ? <div className="inspector-events">{occurrences.map(({ event, start, end }) => <button key={event.id} className="inspector-event" onClick={() => onOpenEvent(event)}>
          <span className="inspector-event-bar" style={{ background: calendars[event.calendar].color }} />
          <div><strong>{event.title}</strong><span><Clock3 size={12} />{event.allDay ? '全天' : `${formatTime(start)}–${formatTime(end)}`}</span>{event.location && <span><MapPin size={12} />{event.location}</span>}</div>
        </button>)}</div> : <p className="inspector-empty">没有日程，享受留白。</p>}
      </div>
      <div className="inspector-section">
        <div className="inspector-title"><span>提醒事项</span><span className="subtle-count">{tasks.filter((task) => !task.completed).length}</span></div>
        {tasks.length ? <div className="inspector-tasks">{tasks.map((task) => <button key={task.id} onClick={() => onOpenReminder(task)}><span className={`task-check-small ${task.completed ? 'done' : ''}`}>{task.completed && <Check size={11} />}</span><span className={task.completed ? 'completed' : ''}>{task.title}</span></button>)}</div> : <p className="inspector-empty">这一天没有待办事项。</p>}
      </div>
    </aside>
  )
}
