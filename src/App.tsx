import { useEffect, useMemo, useRef, useState } from 'react'
import { CalendarDays, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, Keyboard, Menu, PanelLeftClose, PanelLeftOpen, Plus, Sparkles, Sun } from 'lucide-react'
import { Toaster, toast } from 'sonner'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { AppSidebar } from '@/components/AppSidebar'
import { CalendarViews, DayInspector } from '@/components/CalendarViews'
import { EventDialog } from '@/components/EventDialog'
import { ReminderDialog } from '@/components/ReminderDialog'
import { SettingsDialog } from '@/components/SettingsDialog'
import { ShortcutsDialog } from '@/components/ShortcutsDialog'
import { TodayView } from '@/components/TodayView'
import { RemindersView } from '@/components/RemindersView'
import { ImportView } from '@/components/ImportView'
import { useLocalStorage } from '@/hooks/useLocalStorage'
import { CalendarsContext } from '@/hooks/useCalendars'
import { createInitialEvents, createInitialReminders, decodeImportLink, downloadFile, eventsForDay, exportICS, formatMonth, localISO } from '@/lib/schedule'
import { buildNativeNotificationPlan } from '@/lib/notificationPlan'
import { getNativeNotificationPermission, isNativeMacApp, notifyNativeReady, openNativeNotificationSettings, reconcileNativeNotifications, requestNativeNotificationPermission, sendNativeTestNotification, subscribeNativeNotificationActions } from '@/lib/nativeNotifications'
import { calendarDefinition, DEFAULT_CALENDARS } from '@/types'
import type { AppView, CalendarId, CalendarMap, CalendarView, ImportPayload, Reminder, ScheduleEvent } from '@/types'
import './App.css'

export default function App() {
  const [events, setEvents] = useLocalStorage<ScheduleEvent[]>('dayflow-events-v1', createInitialEvents)
  const [reminders, setReminders] = useLocalStorage<Reminder[]>('dayflow-reminders-v1', createInitialReminders)
  const [enabledCalendars, setEnabledCalendars] = useLocalStorage<CalendarId[]>('dayflow-calendars-v1', () => ['work', 'personal', 'study', 'health'])
  const [calendars, setCalendars] = useLocalStorage<CalendarMap>('dayflow-calendar-labels-v1', () => DEFAULT_CALENDARS)
  const [theme, setTheme] = useLocalStorage<'light' | 'dark'>('dayflow-theme-v1', () => window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
  const [view, setView] = useState<AppView>('calendar')
  const [calendarView, setCalendarView] = useState<CalendarView>('month')
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [sidebarVisible, setSidebarVisible] = useState(true)
  const [mobileSidebar, setMobileSidebar] = useState(false)
  const [eventOpen, setEventOpen] = useState(false)
  const [editingEvent, setEditingEvent] = useState<ScheduleEvent | null>(null)
  const [reminderOpen, setReminderOpen] = useState(false)
  const [editingReminder, setEditingReminder] = useState<Reminder | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const [pendingPayload, setPendingPayload] = useState<ImportPayload | null>(null)
  const [notificationState, setNotificationState] = useState<NotificationPermission | 'unsupported'>(() => isNativeMacApp() ? 'default' : 'Notification' in window ? Notification.permission : 'unsupported')
  const [notificationBusy, setNotificationBusy] = useState(false)
  const notified = useRef(new Set<string>())
  const nativeReadySent = useRef(false)
  const notificationRequesting = useRef(false)
  const permissionRevision = useRef(0)

  const visibleEvents = useMemo(() => events.filter((event) => enabledCalendars.includes(event.calendar)), [events, enabledCalendars])
  const todayCount = eventsForDay(visibleEvents, new Date()).length
  const activeReminderCount = reminders.filter((task) => !task.completed).length

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    document.documentElement.style.colorScheme = theme
  }, [theme])

  useEffect(() => {
    const value = new URLSearchParams(window.location.search).get('import')
    if (!value) return
    try {
      setPendingPayload(decodeImportLink(value))
      setView('import')
      window.history.replaceState({}, '', window.location.pathname)
    } catch {
      toast.error('导入链接无法识别', { description: '请让 AI 重新生成导入链接。' })
    }
  }, [])

  useEffect(() => {
    if (!isNativeMacApp()) return
    const revision = ++permissionRevision.current
    void getNativeNotificationPermission().then((permission) => {
      if (revision === permissionRevision.current) setNotificationState(permission)
    })
  }, [])

  useEffect(() => {
    if (isNativeMacApp()) return
    function checkNotifications() {
      if (notificationState !== 'granted') return
      const now = Date.now()
      events.forEach((event) => {
        if (event.reminder < 0 || event.repeat !== 'none') return
        const start = +new Date(event.start)
        const notifyAt = start - event.reminder * 60_000
        const key = `event-${event.id}-${notifyAt}`
        if (notifyAt <= now && start >= now - 60_000 && !notified.current.has(key)) {
          new Notification(event.title, { body: `${new Intl.DateTimeFormat('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(event.start))} 开始${event.location ? ` · ${event.location}` : ''}`, tag: key })
          notified.current.add(key)
        }
      })
      reminders.forEach((task) => {
        const due = +new Date(task.due)
        const key = `task-${task.id}-${due}`
        if (!task.completed && due <= now && due >= now - 60_000 && !notified.current.has(key)) {
          new Notification(task.title, { body: '提醒事项到期了', tag: key })
          notified.current.add(key)
        }
      })
    }
    checkNotifications()
    const timer = window.setInterval(checkNotifications, 30_000)
    return () => window.clearInterval(timer)
  }, [events, reminders, notificationState])

  useEffect(() => {
    if (!isNativeMacApp() || notificationState !== 'granted') return
    let active = true
    const synchronize = () => {
      if (!active) return
      const plan = buildNativeNotificationPlan(events, reminders, calendars)
      void reconcileNativeNotifications(plan)
    }
    synchronize()
    const timer = window.setInterval(synchronize, 15 * 60_000)
    window.addEventListener('focus', synchronize)
    return () => {
      active = false
      window.clearInterval(timer)
      window.removeEventListener('focus', synchronize)
    }
  }, [events, reminders, calendars, notificationState])

  useEffect(() => {
    if (!isNativeMacApp()) return
    const refreshPermission = () => {
      if (notificationRequesting.current) return
      const revision = ++permissionRevision.current
      void getNativeNotificationPermission().then((permission) => {
        if (revision === permissionRevision.current) setNotificationState(permission)
      })
    }
    window.addEventListener('focus', refreshPermission)
    return () => window.removeEventListener('focus', refreshPermission)
  }, [])

  function changeView(next: AppView) {
    setView(next)
    setMobileSidebar(false)
  }

  function createEvent(date = selectedDate) {
    setSelectedDate(date)
    setEditingEvent(null)
    setEventOpen(true)
  }

  function openEvent(event: ScheduleEvent) {
    setEditingEvent(event)
    setEventOpen(true)
  }

  function saveEvent(event: ScheduleEvent) {
    setEvents((current) => current.some((item) => item.id === event.id) ? current.map((item) => item.id === event.id ? event : item) : [...current, event])
    setSelectedDate(new Date(event.start))
    setEventOpen(false)
    toast.success(editingEvent ? '日程已更新' : '日程已添加')
  }

  function deleteEvent(id: string) {
    const deleted = events.find((event) => event.id === id)
    if (!deleted) return
    setEvents((current) => current.filter((event) => event.id !== id))
    setEventOpen(false)
    toast.success('日程已删除', { duration: 5000, action: { label: '撤销', onClick: () => setEvents((current) => current.some((event) => event.id === deleted.id) ? current : [...current, deleted]) } })
  }

  function createReminder() {
    setEditingReminder(null)
    setReminderOpen(true)
  }

  function openReminder(reminder: Reminder) {
    setEditingReminder(reminder)
    setReminderOpen(true)
  }

  function saveReminder(reminder: Reminder) {
    setReminders((current) => current.some((item) => item.id === reminder.id) ? current.map((item) => item.id === reminder.id ? reminder : item) : [...current, reminder])
    setReminderOpen(false)
    toast.success(editingReminder ? '提醒事项已更新' : '提醒事项已添加')
  }

  function toggleReminder(id: string) {
    setReminders((current) => current.map((task) => task.id === id ? { ...task, completed: !task.completed } : task))
  }

  useEffect(() => {
    if (!isNativeMacApp()) return
    return subscribeNativeNotificationActions((action) => {
      if (action.action === 'complete') {
        if (action.kind !== 'reminder') return
        const task = reminders.find((item) => item.id === action.entityId)
        if (!task) return
        if (editingReminder?.id === action.entityId) {
          setReminderOpen(false)
          setEditingReminder(null)
        }
        if (task.completed) return
        setReminders((current) => current.map((item) => item.id === action.entityId ? { ...item, completed: true } : item))
        toast.success('提醒事项已完成', { description: task.title })
        return
      }
      if (action.kind === 'event') {
        const event = events.find((item) => item.id === action.entityId)
        if (!event) {
          toast.info('这项日程已不存在')
          return
        }
        const occurrence = action.occurrenceStart ? new Date(action.occurrenceStart) : new Date(event.start)
        setSelectedDate(Number.isNaN(occurrence.getTime()) ? new Date(event.start) : occurrence)
        setView('calendar')
        setReminderOpen(false)
        setEditingReminder(null)
        setEditingEvent(event)
        setEventOpen(true)
      } else {
        const reminder = reminders.find((item) => item.id === action.entityId)
        if (!reminder) {
          toast.info('这项提醒已不存在')
          return
        }
        setView('reminders')
        setEventOpen(false)
        setEditingEvent(null)
        setEditingReminder(reminder)
        setReminderOpen(true)
      }
    })
  }, [events, reminders, editingReminder, setReminders])

  useEffect(() => {
    if (!isNativeMacApp() || nativeReadySent.current) return
    nativeReadySent.current = true
    notifyNativeReady()
  }, [])

  function deleteReminder(id: string) {
    const deleted = reminders.find((task) => task.id === id)
    if (!deleted) return
    setReminders((current) => current.filter((task) => task.id !== id))
    setReminderOpen(false)
    toast.success('提醒事项已删除', { duration: 5000, action: { label: '撤销', onClick: () => setReminders((current) => current.some((task) => task.id === deleted.id) ? current : [...current, deleted]) } })
  }

  function moveEvent(id: string, date: Date) {
    const original = events.find((event) => event.id === id)
    if (!original || original.repeat !== 'none') return
    const originalStart = new Date(original.start)
    const movedStart = new Date(date)
    movedStart.setHours(originalStart.getHours(), originalStart.getMinutes(), 0, 0)
    const movedEnd = new Date(movedStart.getTime() + (+new Date(original.end) - +originalStart))
    if (localISO(movedStart) === original.start) return
    const moved = { ...original, start: localISO(movedStart), end: localISO(movedEnd) }
    setEvents((current) => current.map((event) => event.id === id ? moved : event))
    setSelectedDate(date)
    toast.success(`已移到 ${new Intl.DateTimeFormat('zh-CN', { month: 'long', day: 'numeric' }).format(date)}`, { duration: 5000, action: { label: '撤销', onClick: () => setEvents((current) => current.map((event) => event.id === id ? { ...event, start: original.start, end: original.end } : event)) } })
  }

  function moveDate(direction: number) {
    const next = new Date(selectedDate)
    if (calendarView === 'month') next.setMonth(next.getMonth() + direction)
    else if (calendarView === 'week') next.setDate(next.getDate() + direction * 7)
    else if (calendarView === 'agenda') next.setDate(next.getDate() + direction * 35)
    else next.setDate(next.getDate() + direction)
    setSelectedDate(next)
  }

  function showDay(date: Date) {
    setSelectedDate(date)
    setCalendarView('day')
  }

  async function enableNotifications() {
    if (notificationRequesting.current || (!isNativeMacApp() && !('Notification' in window))) return
    notificationRequesting.current = true
    setNotificationBusy(true)
    const revision = ++permissionRevision.current
    try {
      const permission = isNativeMacApp()
        ? await requestNativeNotificationPermission()
        : await Notification.requestPermission()
      if (revision !== permissionRevision.current) return
      setNotificationState(permission)
      if (permission === 'granted') toast.success('系统通知已开启', { description: isNativeMacApp() ? '退出 Dayflow 后，macOS 仍会送达已调度的提醒。' : undefined })
      else toast.info('未开启系统通知', { description: '你仍可以在应用内查看到期事项。' })
    } catch {
      toast.error('无法请求通知权限', { description: '请稍后重试或检查系统通知设置。' })
    } finally {
      notificationRequesting.current = false
      setNotificationBusy(false)
    }
  }

  async function testNotification() {
    if (isNativeMacApp()) {
      const sent = await sendNativeTestNotification()
      if (sent) toast.success('测试通知将在 3 秒后送达', { description: '可以切换到其他应用查看 macOS 系统横幅。' })
      else toast.error('测试通知发送失败', { description: '请检查 macOS 通知权限后重试。' })
      return
    }
    if (!('Notification' in window) || Notification.permission !== 'granted') return
    new Notification('日程中枢', { body: '通知工作正常。重要的事，会准时提醒你。' })
    toast.success('测试通知已发送')
  }

  function importEvents(imported: ScheduleEvent[]) {
    setEvents((current) => [...current, ...imported])
    setSelectedDate(new Date(imported[0].start))
    setCalendarView('month')
    setView('calendar')
    toast.success(`已导入 ${imported.length} 项日程`, { description: '日程已保存到此设备。' })
  }

  function createCalendar(name: string, color: string) {
    const id = `custom-${crypto.randomUUID()}`
    setCalendars((current) => ({ ...current, [id]: calendarDefinition(name, color) }))
    setEnabledCalendars((current) => [...new Set([...current, id])])
    toast.success(`已创建“${name}”`, { description: '现在可以在日程和提醒事项中选择它。' })
  }

  function deleteCalendar(id: CalendarId) {
    if (Object.hasOwn(DEFAULT_CALENDARS, id) || !Object.hasOwn(calendars, id)) return
    const target = Object.hasOwn(calendars, 'work') ? 'work' : Object.keys(calendars).find((key) => key !== id)
    if (!target) return
    const eventCount = events.filter((event) => event.calendar === id).length
    const reminderCount = reminders.filter((task) => task.list === id).length
    if (!window.confirm(`确定删除“${calendars[id].name}”吗？\n\n${eventCount} 项日程和 ${reminderCount} 项提醒事项将迁移到“${calendars[target].name}”，分类本身无法恢复。`)) return
    setEvents((current) => current.map((event) => event.calendar === id ? { ...event, calendar: target } : event))
    setReminders((current) => current.map((task) => task.list === id ? { ...task, list: target } : task))
    setCalendars((current) => Object.fromEntries(Object.entries(current).filter(([key]) => key !== id)))
    setEnabledCalendars((current) => current.filter((key) => key !== id))
    if (editingEvent?.calendar === id) { setEventOpen(false); setEditingEvent(null) }
    if (editingReminder?.list === id) { setReminderOpen(false); setEditingReminder(null) }
    toast.success('自定义日历已删除', { description: `关联内容已迁移到“${calendars[target].name}”。` })
  }

  function resetCalendarAppearance() {
    setCalendars((current) => ({ ...current, ...DEFAULT_CALENDARS }))
    toast.success('已恢复默认名称与配色', { description: '你创建的自定义日历保持不变。' })
  }

  async function exportBackup() {
    try {
      const saved = await downloadFile(JSON.stringify({ version: 2, exportedAt: new Date().toISOString(), events, reminders, calendars, enabledCalendars, theme }, null, 2), `日程中枢备份-${new Date().toISOString().slice(0, 10)}.json`, 'application/json')
      if (saved) toast.success('备份已导出')
    } catch {
      toast.error('备份导出失败', { description: '请检查存储位置权限后重试。' })
    }
  }

  async function exportCalendarFile() {
    try {
      const saved = await downloadFile(exportICS(events), `日程中枢-${new Date().toISOString().slice(0, 10)}.ics`, 'text/calendar;charset=utf-8')
      if (saved) toast.success('日历文件已导出')
    } catch {
      toast.error('日历导出失败', { description: '请检查存储位置权限后重试。' })
    }
  }

  async function restoreBackup(file: File) {
    try {
      const data = JSON.parse(await file.text()) as { events?: ScheduleEvent[]; reminders?: Reminder[]; calendars?: CalendarMap; enabledCalendars?: CalendarId[]; theme?: 'light' | 'dark' }
      if (!Array.isArray(data.events) || !Array.isArray(data.reminders)) throw new Error('invalid')
      const restoredCalendars: CalendarMap = data.calendars ? { ...DEFAULT_CALENDARS } : { ...calendars }
      if (data.calendars && typeof data.calendars === 'object') {
        Object.entries(data.calendars).forEach(([id, item]) => {
          if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/.test(id) || ['constructor', 'prototype', '__proto__'].includes(id) || !item || typeof item.name !== 'string') return
          restoredCalendars[id] = calendarDefinition(item.name.trim().slice(0, 16) || DEFAULT_CALENDARS[id]?.name || '未命名日历', typeof item.color === 'string' ? item.color : DEFAULT_CALENDARS[id]?.color || '#5E5CE6')
        })
      }
      const resolveCalendar = (id: CalendarId) => Object.hasOwn(restoredCalendars, id) ? id : 'work'
      setEvents(data.events.map((event) => ({ ...event, calendar: resolveCalendar(event.calendar) })))
      setReminders(data.reminders.map((task) => ({ ...task, list: resolveCalendar(task.list) })))
      setCalendars(restoredCalendars)
      setEnabledCalendars(Array.isArray(data.enabledCalendars) ? [...new Set(data.enabledCalendars.filter((id) => typeof id === 'string' && Object.hasOwn(restoredCalendars, id)))] : Object.keys(restoredCalendars))
      if (data.theme === 'light' || data.theme === 'dark') setTheme(data.theme)
      setSettingsOpen(false)
      toast.success('备份与个性化设置已恢复')
    } catch {
      toast.error('备份文件无效', { description: '请选择由日程中枢导出的 JSON 备份。' })
    }
  }

  useEffect(() => {
    function handleShortcut(event: KeyboardEvent) {
      const target = event.target as HTMLElement
      if (event.metaKey || event.ctrlKey || event.altKey || target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return
      if (document.querySelector('[data-slot="dialog-content"]')) return
      const key = event.key.toLowerCase()
      if (key === 'n') { event.preventDefault(); setEditingEvent(null); setEventOpen(true) }
      else if (key === 'r') { event.preventDefault(); setEditingReminder(null); setReminderOpen(true) }
      else if (key === 't') { event.preventDefault(); setSelectedDate(new Date()); setView('calendar') }
      else if (key === '?') { event.preventDefault(); setShortcutsOpen(true) }
      else if (['1', '2', '3', '4'].includes(key)) {
        event.preventDefault()
        setView('calendar')
        setCalendarView((['month', 'week', 'day', 'agenda'] as CalendarView[])[Number(key) - 1])
      }
    }
    window.addEventListener('keydown', handleShortcut)
    return () => window.removeEventListener('keydown', handleShortcut)
  }, [])

  const calendarViewProps = {
    events: visibleEvents, reminders, selectedDate, calendarView, onSelectDate: setSelectedDate,
    onOpenEvent: openEvent, onOpenReminder: openReminder, onCreateEvent: createEvent, onShowDay: showDay, onMoveEvent: moveEvent,
  }

  return <CalendarsContext.Provider value={calendars}><div className={`app-shell ${sidebarVisible ? '' : 'sidebar-hidden'}`}>
    <div className={`desktop-sidebar ${sidebarVisible ? '' : 'collapsed'}`}><AppSidebar view={view} onViewChange={changeView} enabledCalendars={enabledCalendars} onToggleCalendar={(id) => setEnabledCalendars((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])} todayCount={todayCount} reminderCount={activeReminderCount} onOpenSettings={() => setSettingsOpen(true)} /></div>
    {mobileSidebar && <div className="mobile-sidebar-overlay" onClick={() => setMobileSidebar(false)}><div onClick={(e) => e.stopPropagation()}><AppSidebar view={view} onViewChange={changeView} enabledCalendars={enabledCalendars} onToggleCalendar={(id) => setEnabledCalendars((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])} todayCount={todayCount} reminderCount={activeReminderCount} onOpenSettings={() => { setSettingsOpen(true); setMobileSidebar(false) }} /></div></div>}
    <div className="app-content">
      <header className="top-toolbar">
        <button className="icon-button desktop-sidebar-toggle" onClick={() => setSidebarVisible((value) => !value)} aria-label={sidebarVisible ? '隐藏侧栏' : '显示侧栏'}>{sidebarVisible ? <PanelLeftClose size={19} /> : <PanelLeftOpen size={19} />}</button>
        <button className="icon-button mobile-menu-button" onClick={() => setMobileSidebar(true)} aria-label="打开导航"><Menu size={20} /></button>
        <div className="toolbar-context">{view === 'calendar' ? <><button className="today-button" onClick={() => setSelectedDate(new Date())}>今天</button><div className="date-nav"><button onClick={() => moveDate(-1)} aria-label="上一时间段"><ChevronLeft size={18} /></button><button onClick={() => moveDate(1)} aria-label="下一时间段"><ChevronRight size={18} /></button></div></> : <span>{view === 'today' ? '今日概览' : view === 'reminders' ? '我的清单' : '开放日程导入'}</span>}</div>
        <div className="toolbar-spacer" />
        <button className="icon-button shortcuts-trigger" onClick={() => setShortcutsOpen(true)} aria-label="键盘快捷键" title="键盘快捷键（?）"><Keyboard size={18} /></button>
        {view !== 'import' && <button className="toolbar-ai-button" onClick={() => setView('import')}><Sparkles size={16} /><span>AI 导入</span></button>}
        <DropdownMenu><DropdownMenuTrigger asChild><button className="add-button"><Plus size={17} /><span>新建</span><ChevronDown size={13} /></button></DropdownMenuTrigger><DropdownMenuContent align="end" className="quick-add-menu"><DropdownMenuItem onSelect={() => createEvent()}><CalendarDays size={16} />新建日程</DropdownMenuItem><DropdownMenuItem onSelect={createReminder}><CheckCircle2 size={16} />新建提醒事项</DropdownMenuItem></DropdownMenuContent></DropdownMenu>
      </header>

      {view === 'calendar' && <div className="calendar-screen"><main className="calendar-main"><div className="calendar-heading"><div><h1>{calendarView === 'agenda' ? '日程' : formatMonth(selectedDate)}</h1><p>{calendarView === 'month' ? `${eventsForDay(visibleEvents, selectedDate).length} 项安排在选中的日期` : calendarView === 'agenda' ? '按时间顺序查看所有安排' : '点击日程可查看和编辑详情'}</p></div><div className="view-segmented" aria-label="日历视图">{(['month', 'week', 'day', 'agenda'] as CalendarView[]).map((item) => <button key={item} className={calendarView === item ? 'active' : ''} onClick={() => setCalendarView(item)}>{({ month: '月', week: '周', day: '日', agenda: '列表' })[item]}</button>)}</div></div><CalendarViews {...calendarViewProps} /></main><DayInspector {...calendarViewProps} /></div>}
      {view === 'today' && <TodayView events={visibleEvents} reminders={reminders} onOpenEvent={openEvent} onOpenReminder={openReminder} onToggleReminder={toggleReminder} onCreateEvent={() => createEvent(new Date())} onOpenImport={() => setView('import')} onShowCalendar={() => { setSelectedDate(new Date()); setView('calendar') }} />}
      {view === 'reminders' && <RemindersView reminders={reminders} onOpenReminder={openReminder} onToggleReminder={toggleReminder} onCreateReminder={createReminder} />}
      {view === 'import' && <ImportView events={events} pendingPayload={pendingPayload} onConsumePending={() => setPendingPayload(null)} onImport={importEvents} />}

      <nav className="mobile-bottom-nav" aria-label="移动端导航">{([{ id: 'today', label: '今天', icon: Sun }, { id: 'calendar', label: '日历', icon: CalendarDays }, { id: 'reminders', label: '提醒', icon: CheckCircle2 }, { id: 'import', label: 'AI 导入', icon: Sparkles }] as const).map((item) => <button key={item.id} className={view === item.id ? 'active' : ''} onClick={() => setView(item.id)}><item.icon size={20} /><span>{item.label}</span></button>)}</nav>
    </div>

    {eventOpen && <EventDialog key={editingEvent?.id || 'new-event'} open event={editingEvent} defaultDate={selectedDate} onOpenChange={setEventOpen} onSave={saveEvent} onDelete={deleteEvent} />}
    {reminderOpen && <ReminderDialog key={editingReminder?.id || 'new-reminder'} open reminder={editingReminder} defaultDate={selectedDate} onOpenChange={setReminderOpen} onSave={saveReminder} onDelete={deleteReminder} />}
    <SettingsDialog
      open={settingsOpen}
      onOpenChange={setSettingsOpen}
      theme={theme}
      onThemeChange={setTheme}
      calendars={calendars}
      onCalendarsChange={setCalendars}
      onCreateCalendar={createCalendar}
      onDeleteCalendar={deleteCalendar}
      onResetCalendars={resetCalendarAppearance}
      notificationState={notificationState}
      notificationBusy={notificationBusy}
      onEnableNotifications={enableNotifications}
      onTestNotification={testNotification}
      onOpenNotificationSettings={() => void openNativeNotificationSettings()}
      onExportICS={() => void exportCalendarFile()}
      onExportJSON={() => void exportBackup()}
      onImportJSON={restoreBackup}
      onReset={() => {
        if (window.confirm('确定恢复示例数据吗？当前的日程和提醒事项会被替换。')) {
          setEvents(createInitialEvents())
          setReminders(createInitialReminders())
          setSettingsOpen(false)
          toast.success('已恢复示例数据')
        }
      }}
    />
    <ShortcutsDialog open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
    <Toaster position="bottom-center" closeButton toastOptions={{ className: 'app-toast' }} />
  </div></CalendarsContext.Provider>
}
