import { useState } from 'react'
import { CalendarDays, MapPin, Repeat2, Trash2 } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useCalendars } from '@/hooks/useCalendars'
import type { CalendarId, RepeatRule, ScheduleEvent } from '@/types'
import { atTime, dateKey, localISO } from '@/lib/schedule'

interface Props {
  open: boolean
  event: ScheduleEvent | null
  defaultDate: Date
  onOpenChange: (open: boolean) => void
  onSave: (event: ScheduleEvent) => void
  onDelete: (id: string) => void
}

export function EventDialog({ open, event, defaultDate, onOpenChange, onSave, onDelete }: Props) {
  const CALENDARS = useCalendars()
  const initialStart = event ? new Date(event.start) : defaultDate
  const initialEnd = event ? new Date(event.end) : new Date(defaultDate.getTime() + 3600000)
  const [title, setTitle] = useState(event?.title || '')
  const [startDate, setStartDate] = useState(dateKey(initialStart))
  const [endDate, setEndDate] = useState(dateKey(initialEnd))
  const [startTime, setStartTime] = useState(event ? localISO(initialStart).slice(11, 16) : '09:00')
  const [endTime, setEndTime] = useState(event ? localISO(initialEnd).slice(11, 16) : '10:00')
  const [allDay, setAllDay] = useState(event?.allDay || false)
  const [calendar, setCalendar] = useState<CalendarId>(event?.calendar || 'work')
  const [location, setLocation] = useState(event?.location || '')
  const [notes, setNotes] = useState(event?.notes || '')
  const [reminder, setReminder] = useState(event?.reminder ?? 15)
  const [repeat, setRepeat] = useState<RepeatRule>(event?.repeat || 'none')
  const [error, setError] = useState('')

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) { setError('请输入日程标题'); return }
    const start = allDay ? atTime(new Date(`${startDate}T00:00`), 0) : `${startDate}T${startTime}`
    const end = allDay ? atTime(new Date(`${endDate}T00:00`), 23, 59) : `${endDate}T${endTime}`
    if (new Date(end) <= new Date(start)) { setError('结束时间需要晚于开始时间'); return }
    onSave({
      id: event?.id || crypto.randomUUID(), title: title.trim(), start, end, allDay, calendar,
      location: location.trim() || undefined, notes: notes.trim() || undefined, reminder, repeat,
      source: event?.source, createdAt: event?.createdAt || new Date().toISOString(),
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="schedule-dialog" showCloseButton={false}>
        <DialogHeader><DialogTitle>{event ? '编辑日程' : '新建日程'}</DialogTitle><DialogDescription>安排时间，并选择适合你的提醒方式。</DialogDescription></DialogHeader>
        <form onSubmit={submit} className="schedule-form">
          <input className="title-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="日程标题" autoFocus aria-label="日程标题" />
          <div className="form-section">
            <div className="form-row icon-row"><CalendarDays size={18} /><div className="form-fields date-fields">
              <label><span>开始</span><input type="date" value={startDate} onChange={(e) => { setStartDate(e.target.value); if (endDate < e.target.value) setEndDate(e.target.value) }} required /></label>
              {!allDay && <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} aria-label="开始时间" required />}
              <label><span>结束</span><input type="date" value={endDate} min={startDate} onChange={(e) => setEndDate(e.target.value)} required /></label>
              {!allDay && <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} aria-label="结束时间" required />}
            </div></div>
            <label className="form-row toggle-row"><span>全天</span><input type="checkbox" className="apple-switch" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} /></label>
            <label className="form-row"><span>重复</span><div className="select-with-icon"><Repeat2 size={15} /><select value={repeat} onChange={(e) => setRepeat(e.target.value as RepeatRule)}><option value="none">永不</option><option value="daily">每天</option><option value="weekly">每周</option><option value="monthly">每月</option><option value="yearly">每年</option></select></div></label>
            <label className="form-row"><span>提醒</span><select value={reminder} onChange={(e) => setReminder(Number(e.target.value))}><option value={0}>日程开始时</option><option value={5}>提前 5 分钟</option><option value={15}>提前 15 分钟</option><option value={30}>提前 30 分钟</option><option value={60}>提前 1 小时</option><option value={1440}>提前 1 天</option><option value={-1}>不提醒</option></select></label>
          </div>
          <div className="form-section">
            <label className="form-row"><span>日历</span><select aria-label="日历" value={calendar} onChange={(e) => setCalendar(e.target.value as CalendarId)}>{Object.entries(CALENDARS).map(([id, item]) => <option key={id} value={id}>{item.name}</option>)}</select></label>
            <label className="form-row icon-row"><MapPin size={18} /><input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="位置或视频会议链接" /></label>
            <label className="notes-field"><span>备注</span><textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="添加备注" rows={3} /></label>
          </div>
          {error && <p className="form-error" role="alert">{error}</p>}
          <div className="dialog-actions">
            {event && <button type="button" className="danger-button" onClick={() => onDelete(event.id)}><Trash2 size={16} />删除</button>}
            <span className="action-spacer" /><button type="button" className="secondary-button" onClick={() => onOpenChange(false)}>取消</button><button type="submit" className="primary-button">存储</button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
