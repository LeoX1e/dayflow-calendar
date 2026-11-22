import { ArrowRight, CalendarPlus, CheckCircle2, Clock3, MapPin, Sparkles } from 'lucide-react'
import type { Reminder, ScheduleEvent } from '@/types'
import { useCalendars } from '@/hooks/useCalendars'
import { eventsForDay, formatFullDate, formatTime } from '@/lib/schedule'

interface Props {
  events: ScheduleEvent[]
  reminders: Reminder[]
  onOpenEvent: (event: ScheduleEvent) => void
  onOpenReminder: (reminder: Reminder) => void
  onToggleReminder: (id: string) => void
  onCreateEvent: () => void
  onOpenImport: () => void
  onShowCalendar: () => void
}

export function TodayView({ events, reminders, onOpenEvent, onOpenReminder, onToggleReminder, onCreateEvent, onOpenImport, onShowCalendar }: Props) {
  const CALENDARS = useCalendars()
  const occurrences = eventsForDay(events, new Date())
  const tasks = reminders.filter((task) => !task.completed && new Date(task.due) <= new Date(new Date().setHours(23, 59, 59))).sort((a, b) => +new Date(a.due) - +new Date(b.due))
  const next = occurrences.find(({ end }) => end > new Date())
  const hour = new Date().getHours()
  const greeting = hour < 12 ? '早上好' : hour < 18 ? '下午好' : '晚上好'

  return <div className="today-view page-scroll">
    <div className="today-hero"><div><p>{formatFullDate(new Date())}</p><h1>{greeting}。</h1><span>今天有 {occurrences.length} 项日程，{tasks.length} 项待办。</span></div><button className="round-add-button" onClick={onCreateEvent} aria-label="新建日程"><CalendarPlus size={22} /></button></div>
    {next ? <section className="next-event-section"><div className="section-label">接下来</div><button className="next-event" onClick={() => onOpenEvent(next.event)} style={{ '--event-color': CALENDARS[next.event.calendar].color } as React.CSSProperties}><div className="next-event-time"><strong>{next.event.allDay ? '全天' : formatTime(next.start)}</strong><span>{next.event.allDay ? '' : formatTime(next.end)}</span></div><div className="next-event-copy"><span>{next.start <= new Date() ? '正在进行' : '下一项日程'}</span><h2>{next.event.title}</h2><p>{next.event.location ? <><MapPin size={14} />{next.event.location}</> : <><Clock3 size={14} />{CALENDARS[next.event.calendar].name}</>}</p></div><ArrowRight size={20} /></button></section> : <section className="next-event-section"><div className="section-label">接下来</div><div className="clear-day"><CheckCircle2 size={24} /><div><strong>今天的日程已完成</strong><span>余下的时间，由你自由安排。</span></div></div></section>}
    <div className="today-columns">
      <section className="today-schedule"><div className="section-title-row"><h2>今日安排</h2><button onClick={onShowCalendar}>查看日历<ArrowRight size={14} /></button></div>{occurrences.length ? <div className="simple-timeline">{occurrences.map(({ event, start, end }) => <button key={event.id} onClick={() => onOpenEvent(event)} className="simple-timeline-row"><div className="simple-time">{event.allDay ? '全天' : formatTime(start)}<span>{!event.allDay && formatTime(end)}</span></div><span className="timeline-marker" style={{ background: CALENDARS[event.calendar].color }} /><div><strong>{event.title}</strong><span>{event.location || CALENDARS[event.calendar].name}</span></div></button>)}</div> : <p className="muted-empty">今天还没有安排日程。</p>}</section>
      <section className="today-tasks"><div className="section-title-row"><h2>待办</h2><span>{tasks.length} 项</span></div>{tasks.length ? <div className="today-task-list">{tasks.slice(0, 5).map((task) => <div className="today-task" key={task.id}><button className={`round-checkbox priority-${task.priority}`} onClick={() => onToggleReminder(task.id)} aria-label={`完成 ${task.title}`} /><button className="task-main-button" onClick={() => onOpenReminder(task)}><strong>{task.title}</strong><span>{formatTime(task.due)} · {CALENDARS[task.list].name}</span></button></div>)}</div> : <p className="muted-empty">所有待办都完成了。</p>}</section>
    </div>
    <button className="ai-suggestion" onClick={onOpenImport}><span className="ai-suggestion-icon"><Sparkles size={19} /></span><div><strong>让 AI 帮你安排日程</strong><span>从任意 AI 或 Agent 导入，确认后自动加入日历。</span></div><ArrowRight size={18} /></button>
  </div>
}
