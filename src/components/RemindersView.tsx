import { useMemo, useState } from 'react'
import { Check, ChevronRight, Flag, Plus, Search } from 'lucide-react'
import type { Reminder } from '@/types'
import { useCalendars } from '@/hooks/useCalendars'
import { formatSmartDate, isSameDay } from '@/lib/schedule'

interface Props {
  reminders: Reminder[]
  onOpenReminder: (reminder: Reminder) => void
  onToggleReminder: (id: string) => void
  onCreateReminder: () => void
}

type Filter = 'today' | 'scheduled' | 'all' | 'completed'

export function RemindersView({ reminders, onOpenReminder, onToggleReminder, onCreateReminder }: Props) {
  const CALENDARS = useCalendars()
  const [filter, setFilter] = useState<Filter>('today')
  const [query, setQuery] = useState('')
  const filtered = useMemo(() => reminders.filter((task) => {
    if (query && !`${task.title}${task.notes || ''}`.toLowerCase().includes(query.toLowerCase())) return false
    if (filter === 'today') return !task.completed && isSameDay(task.due, new Date())
    if (filter === 'scheduled') return !task.completed
    if (filter === 'completed') return task.completed
    return true
  }).sort((a, b) => +new Date(a.due) - +new Date(b.due)), [reminders, filter, query])
  const counts = {
    today: reminders.filter((task) => !task.completed && isSameDay(task.due, new Date())).length,
    scheduled: reminders.filter((task) => !task.completed).length,
    all: reminders.length,
    completed: reminders.filter((task) => task.completed).length,
  }
  const overdue = filtered.filter((task) => !task.completed && new Date(task.due) < new Date() && !isSameDay(task.due, new Date()))
  const today = filtered.filter((task) => !task.completed && isSameDay(task.due, new Date()))
  const upcoming = filtered.filter((task) => !task.completed && new Date(task.due) > new Date() && !isSameDay(task.due, new Date()))
  const completed = filtered.filter((task) => task.completed)
  const groups = filter === 'all' || filter === 'scheduled' ? [
    { name: '已逾期', items: overdue }, { name: '今天', items: today }, { name: '接下来', items: upcoming }, { name: '已完成', items: completed },
  ] : [{ name: filter === 'completed' ? '已完成' : '今天', items: filtered }]

  function TaskRow({ task }: { task: Reminder }) {
    return <div className={`reminder-row ${task.completed ? 'is-completed' : ''}`}>
      <button className={`round-checkbox priority-${task.priority} ${task.completed ? 'checked' : ''}`} onClick={() => onToggleReminder(task.id)} aria-label={task.completed ? `恢复 ${task.title}` : `完成 ${task.title}`}>{task.completed && <Check size={14} />}</button>
      <button className="reminder-main" onClick={() => onOpenReminder(task)}><strong>{task.title}</strong>{task.notes && <span>{task.notes}</span>}<small className={!task.completed && new Date(task.due) < new Date() ? 'overdue-text' : ''}>{formatSmartDate(task.due)} · {CALENDARS[task.list].name}</small></button>
      {task.priority !== 'none' && <Flag size={14} className={`priority-flag ${task.priority}`} fill="currentColor" />}
      <button className="row-chevron" onClick={() => onOpenReminder(task)} aria-label={`编辑 ${task.title}`}><ChevronRight size={16} /></button>
    </div>
  }

  return <div className="reminders-view page-scroll">
    <div className="content-heading"><div><h1>提醒事项</h1><p>把要做的事，变成刚刚好的提醒。</p></div><button className="primary-button" onClick={onCreateReminder}><Plus size={17} />新建提醒</button></div>
    <div className="reminder-stats">{([{ id: 'today', name: '今天', color: 'blue' }, { id: 'scheduled', name: '已计划', color: 'orange' }, { id: 'all', name: '全部', color: 'gray' }, { id: 'completed', name: '已完成', color: 'green' }] as const).map((item) => <button key={item.id} className={`reminder-stat ${filter === item.id ? 'active' : ''}`} onClick={() => setFilter(item.id)}><span className={`stat-icon ${item.color}`}>{item.id === 'completed' ? <Check size={18} /> : <Flag size={18} />}</span><strong>{counts[item.id]}</strong><span>{item.name}</span></button>)}</div>
    <div className="reminder-toolbar"><div className="search-field"><Search size={16} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="搜索提醒事项" aria-label="搜索提醒事项" /></div><span>{filtered.length} 项</span></div>
    <div className="reminder-groups">{groups.map((group) => group.items.length > 0 && <section key={group.name} className="reminder-group"><h2>{group.name}<span>{group.items.length}</span></h2><div className="reminder-list">{group.items.map((task) => <TaskRow key={task.id} task={task} />)}</div></section>)}{!filtered.length && <div className="empty-state"><Check size={32} /><h3>{query ? '没有匹配的事项' : filter === 'completed' ? '还没有已完成的事项' : '这里没有待办事项'}</h3><p>{query ? '试试其他关键词。' : '一切都安排好了。'}</p>{!query && filter !== 'completed' && <button className="primary-button" onClick={onCreateReminder}>新建提醒</button>}</div>}</div>
  </div>
}
