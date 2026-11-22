import { useState } from 'react'
import { Flag, Trash2 } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useCalendars } from '@/hooks/useCalendars'
import type { CalendarId, Reminder } from '@/types'
import { dateKey, localISO } from '@/lib/schedule'

interface Props {
  open: boolean
  reminder: Reminder | null
  defaultDate: Date
  onOpenChange: (open: boolean) => void
  onSave: (reminder: Reminder) => void
  onDelete: (id: string) => void
}

export function ReminderDialog({ open, reminder, defaultDate, onOpenChange, onSave, onDelete }: Props) {
  const CALENDARS = useCalendars()
  const initialDue = reminder ? new Date(reminder.due) : defaultDate
  const [title, setTitle] = useState(reminder?.title || '')
  const [date, setDate] = useState(dateKey(initialDue))
  const [time, setTime] = useState(reminder ? localISO(initialDue).slice(11, 16) : '18:00')
  const [notes, setNotes] = useState(reminder?.notes || '')
  const [list, setList] = useState<CalendarId>(reminder?.list || 'personal')
  const [priority, setPriority] = useState<Reminder['priority']>(reminder?.priority || 'none')
  const [error, setError] = useState('')

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) { setError('请输入提醒内容'); return }
    onSave({ id: reminder?.id || crypto.randomUUID(), title: title.trim(), due: `${date}T${time}`, notes: notes.trim() || undefined, list, priority, completed: reminder?.completed || false, createdAt: reminder?.createdAt || new Date().toISOString() })
  }

  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="schedule-dialog reminder-dialog" showCloseButton={false}>
    <DialogHeader><DialogTitle>{reminder ? '编辑提醒事项' : '新建提醒事项'}</DialogTitle><DialogDescription>把要做的事记下来，在合适的时间收到提醒。</DialogDescription></DialogHeader>
    <form onSubmit={submit} className="schedule-form">
      <input className="title-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="要提醒什么？" autoFocus aria-label="提醒事项标题" />
      <div className="form-section">
        <div className="form-row"><span>日期与时间</span><div className="inline-inputs"><input type="date" value={date} onChange={(e) => setDate(e.target.value)} required /><input type="time" value={time} onChange={(e) => setTime(e.target.value)} aria-label="提醒时间" required /></div></div>
        <label className="form-row"><span>列表</span><select aria-label="列表" value={list} onChange={(e) => setList(e.target.value as CalendarId)}>{Object.entries(CALENDARS).map(([id, item]) => <option key={id} value={id}>{item.name}</option>)}</select></label>
        <label className="form-row"><span>优先级</span><div className="select-with-icon"><Flag size={15} /><select value={priority} onChange={(e) => setPriority(e.target.value as Reminder['priority'])}><option value="none">无</option><option value="low">低</option><option value="medium">中</option><option value="high">高</option></select></div></label>
        <label className="notes-field"><span>备注</span><textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="添加备注" rows={3} /></label>
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="dialog-actions">{reminder && <button type="button" className="danger-button" onClick={() => onDelete(reminder.id)}><Trash2 size={16} />删除</button>}<span className="action-spacer" /><button type="button" className="secondary-button" onClick={() => onOpenChange(false)}>取消</button><button type="submit" className="primary-button">存储</button></div>
    </form>
  </DialogContent></Dialog>
}
