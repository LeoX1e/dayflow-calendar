import { CalendarDays, CheckCircle2, ChevronRight, Database, Settings, Sparkles, Sun } from 'lucide-react'
import { useCalendars } from '@/hooks/useCalendars'
import { calendarContrastColor } from '@/types'
import type { AppView, CalendarId } from '@/types'

interface Props {
  view: AppView
  onViewChange: (view: AppView) => void
  enabledCalendars: CalendarId[]
  onToggleCalendar: (id: CalendarId) => void
  todayCount: number
  reminderCount: number
  onOpenSettings: () => void
}

const navigation = [
  { id: 'today' as const, label: '今天', icon: Sun },
  { id: 'calendar' as const, label: '日历', icon: CalendarDays },
  { id: 'reminders' as const, label: '提醒事项', icon: CheckCircle2 },
  { id: 'import' as const, label: 'AI 导入', icon: Sparkles },
]

export function AppSidebar({ view, onViewChange, enabledCalendars, onToggleCalendar, todayCount, reminderCount, onOpenSettings }: Props) {
  const CALENDARS = useCalendars()
  return (
    <aside className="app-sidebar" aria-label="主导航">
      <div className="brand">
        <div className="brand-icon" aria-hidden="true"><img className="brand-logo" src="./dayflow-logo.svg" alt="" /></div>
        <div><strong>日程中枢</strong><span>Dayflow</span></div>
      </div>

      <nav className="primary-nav">
        {navigation.map((item) => {
          const Icon = item.icon
          const count = item.id === 'today' ? todayCount : item.id === 'reminders' ? reminderCount : null
          return (
            <button key={item.id} className={`nav-item ${view === item.id ? 'active' : ''}`} onClick={() => onViewChange(item.id)} aria-current={view === item.id ? 'page' : undefined}>
              <Icon size={18} strokeWidth={view === item.id ? 2.3 : 1.9} />
              <span>{item.label}</span>
              {count !== null && count > 0 && <span className="nav-count">{count}</span>}
              {item.id === 'import' && <ChevronRight className="nav-chevron" size={14} />}
            </button>
          )
        })}
      </nav>

      <div className="sidebar-section">
        <div className="sidebar-section-heading"><div className="sidebar-section-title">我的日历</div><button onClick={onOpenSettings} aria-label="编辑日历标签">编辑</button></div>
        <div className="calendar-filters">
          {(Object.keys(CALENDARS) as CalendarId[]).map((id) => (
            <button key={id} className="calendar-filter" onClick={() => onToggleCalendar(id)} role="checkbox" aria-checked={enabledCalendars.includes(id)} title={`${CALENDARS[id].name}：点击显示或隐藏`}>
              <span className={`filter-check ${enabledCalendars.includes(id) ? 'checked' : ''}`} style={{ '--calendar-color': CALENDARS[id].color, color: calendarContrastColor(CALENDARS[id].color) } as React.CSSProperties}>
                {enabledCalendars.includes(id) && <span>✓</span>}
              </span>
              <span className="calendar-filter-name">{CALENDARS[id].name}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="sidebar-spacer" />
      <div className="local-status"><Database size={14} /><span>已保存在此设备</span><span className="status-dot" /></div>
      <button className="nav-item settings-button" onClick={onOpenSettings}><Settings size={18} /><span>设置与数据</span></button>
    </aside>
  )
}
