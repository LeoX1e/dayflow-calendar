import { useRef, useState } from 'react'
import { BellRing, Check, Download, FileJson, Moon, Plus, RotateCcw, Sun, Trash2, Upload, X } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { calendarDefinition, DEFAULT_CALENDARS } from '@/types'
import type { CalendarId, CalendarMap } from '@/types'
import { isNativeMacApp } from '@/lib/nativeBridge'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  theme: 'light' | 'dark'
  onThemeChange: (theme: 'light' | 'dark') => void
  calendars: CalendarMap
  onCalendarsChange: (calendars: CalendarMap) => void
  onCreateCalendar: (name: string, color: string) => void
  onDeleteCalendar: (id: CalendarId) => void
  onResetCalendars: () => void
  notificationState: NotificationPermission | 'unsupported'
  notificationBusy: boolean
  onEnableNotifications: () => void
  onTestNotification: () => void
  onOpenNotificationSettings: () => void
  onExportICS: () => void
  onExportJSON: () => void
  onImportJSON: (file: File) => void
  onReset: () => void
}

const CALENDAR_COLORS = [
  { name: '靛蓝', value: '#5E5CE6' },
  { name: '蓝色', value: '#0A84FF' },
  { name: '紫色', value: '#AF52DE' },
  { name: '桃粉', value: '#FF375F' },
  { name: '红色', value: '#FF3B30' },
  { name: '橙色', value: '#FF9F0A' },
  { name: '金色', value: '#FFD60A' },
  { name: '绿色', value: '#34C759' },
  { name: '薄荷', value: '#30B0C7' },
  { name: '青色', value: '#32ADE6' },
  { name: '棕色', value: '#A2845E' },
  { name: '石墨', value: '#636366' },
]

function HexColorInput({ name, color, onChange }: { name: string; color: string; onChange: (color: string) => void }) {
  return <label className="hex-color-field" title="输入 6 位 HEX 色值，例如 #AF52DE"><span>HEX</span><input key={color} defaultValue={color} maxLength={7} spellCheck={false} onChange={(event) => { const next = event.target.value.toUpperCase(); event.currentTarget.value = next; if (/^#[0-9A-F]{6}$/i.test(next)) onChange(next) }} onBlur={(event) => { const candidate = event.currentTarget.value.startsWith('#') ? event.currentTarget.value : `#${event.currentTarget.value}`; if (/^#[0-9A-F]{6}$/i.test(candidate)) onChange(candidate.toUpperCase()); else event.currentTarget.value = color }} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); event.currentTarget.blur() } }} aria-label={`${name} HEX 颜色`} /></label>
}

export function SettingsDialog(props: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [newColor, setNewColor] = useState('#AF52DE')
  const [createError, setCreateError] = useState('')

  function updateCalendar(id: CalendarId, name: string, color: string) {
    props.onCalendarsChange({ ...props.calendars, [id]: calendarDefinition(name, color) })
  }

  function createCalendar(event: React.FormEvent) {
    event.preventDefault()
    const name = newName.trim()
    if (!name) { setCreateError('请输入日历或标签名称'); return }
    if (Object.values(props.calendars).some((item) => item.name.trim().toLocaleLowerCase() === name.toLocaleLowerCase())) { setCreateError('已经有同名日历，请换一个名称'); return }
    props.onCreateCalendar(name, newColor)
    setNewName('')
    setNewColor('#AF52DE')
    setCreateError('')
    setCreating(false)
  }

  return <Dialog open={props.open} onOpenChange={props.onOpenChange}><DialogContent className="schedule-dialog settings-dialog">
    <DialogHeader><DialogTitle>设置与数据</DialogTitle><DialogDescription>调整个性化外观，管理日历标签和你的本地数据。</DialogDescription></DialogHeader>
    <div className="settings-group"><div className="settings-label">外观</div><div className="settings-segmented"><button className={props.theme === 'light' ? 'active' : ''} onClick={() => props.onThemeChange('light')}><Sun size={16} />浅色</button><button className={props.theme === 'dark' ? 'active' : ''} onClick={() => props.onThemeChange('dark')}><Moon size={16} />深色</button></div></div>

    <div className="settings-group calendar-settings-group">
      <div className="settings-label-row"><div className="settings-label">日历与标签</div><button className="settings-reset-link" onClick={props.onResetCalendars}>恢复默认</button></div>
      <p className="settings-help">自由创建分类，所有日程、提醒和筛选会立即同步。</p>
      <div className="calendar-editor-list">{Object.keys(props.calendars).map((id, index) => {
        const item = props.calendars[id]
        const isBuiltIn = Object.hasOwn(DEFAULT_CALENDARS, id)
        return <div className="calendar-editor-row" key={id}>
          <div className="calendar-editor-main">
            <label className="custom-color-control" title={`${item.name || `日历 ${index + 1}`}：打开自由取色器`}>
              <input type="color" value={item.color} onChange={(event) => updateCalendar(id, item.name, event.target.value.toUpperCase())} aria-label={`自由设置${item.name || `日历 ${index + 1}`}颜色`} />
              <span style={{ background: item.color }} />
            </label>
            <input className="calendar-name-input" value={item.name} maxLength={16} onChange={(event) => updateCalendar(id, event.target.value, item.color)} onBlur={() => { if (!item.name.trim()) updateCalendar(id, DEFAULT_CALENDARS[id]?.name || '未命名日历', item.color); else if (item.name !== item.name.trim()) updateCalendar(id, item.name.trim(), item.color) }} aria-label={`日历 ${index + 1} 名称`} placeholder="日历名称" />
            {isBuiltIn ? <span className="built-in-calendar-mark">内置</span> : <button type="button" className="delete-calendar-button" onClick={() => props.onDeleteCalendar(id)} aria-label={`删除${item.name}`} title="删除日历，关联内容将迁移到工作"><Trash2 size={15} /></button>}
          </div>
          <div className="calendar-color-options">
            <div className="color-presets" aria-label={`${item.name}推荐颜色`}>{CALENDAR_COLORS.map((color) => <button type="button" key={color.value} className={item.color.toUpperCase() === color.value ? 'active' : ''} style={{ '--preset-color': color.value } as React.CSSProperties} onClick={() => updateCalendar(id, item.name, color.value)} aria-label={`将${item.name || `日历 ${index + 1}`}设为${color.name}`} title={color.name} />)}</div>
            <HexColorInput name={item.name || `日历 ${index + 1}`} color={item.color} onChange={(color) => updateCalendar(id, item.name, color)} />
          </div>
        </div>
      })}</div>

      {creating ? <form className="new-calendar-form" onSubmit={createCalendar}>
        <div className="new-calendar-heading"><strong>新建日历或标签</strong><button type="button" onClick={() => { setCreating(false); setCreateError('') }} aria-label="取消新建日历"><X size={16} /></button></div>
        <div className="new-calendar-fields"><label className="custom-color-control" title="打开自由取色器"><input type="color" value={newColor} onChange={(event) => setNewColor(event.target.value.toUpperCase())} aria-label="新日历自由颜色" /><span style={{ background: newColor }} /></label><input className="calendar-name-input" value={newName} maxLength={16} autoFocus onChange={(event) => { setNewName(event.target.value); setCreateError('') }} placeholder="例如：健身、项目 A、家庭" aria-label="新日历名称" /><button className="small-button" type="submit" disabled={!newName.trim()}>创建</button></div>
        <div className="calendar-color-options"><div className="color-presets" aria-label="新日历推荐颜色">{CALENDAR_COLORS.map((color) => <button type="button" key={color.value} className={newColor === color.value ? 'active' : ''} style={{ '--preset-color': color.value } as React.CSSProperties} onClick={() => setNewColor(color.value)} aria-label={`新日历设为${color.name}`} title={color.name} />)}</div><HexColorInput name="新日历" color={newColor} onChange={setNewColor} /></div>
        {createError && <p className="form-error" role="alert">{createError}</p>}
      </form> : <button className="new-calendar-button" onClick={() => setCreating(true)}><Plus size={16} />新建日历或标签</button>}
      <p className="calendar-settings-note">点击圆形色块可自由取色，也可输入任意 6 位 HEX 色值。删除自定义日历后，关联内容会迁移到“工作”。</p>
    </div>

    <div className="settings-group">
      <div className="settings-label">通知</div>
      <div className="settings-row">
        <div className="settings-row-icon"><BellRing size={19} /></div>
        <div>
          <strong>系统通知</strong>
          <span>{props.notificationState === 'granted'
            ? isNativeMacApp() ? '已允许，退出应用后仍可由 macOS 送达提醒' : '已允许，应用打开时会检查到期提醒'
            : props.notificationState === 'denied'
              ? isNativeMacApp() ? '已在 macOS 通知设置中关闭' : '已被浏览器阻止，请在网站设置中开启'
              : props.notificationState === 'unsupported'
                ? '当前环境不支持系统通知'
                : isNativeMacApp() ? '允许后，即使退出 Dayflow 也能接收提醒' : '允许后接收日程与待办提醒'}</span>
        </div>
        {props.notificationState === 'granted'
          ? <button className="small-button" onClick={props.onTestNotification}>测试</button>
          : props.notificationState === 'denied' && isNativeMacApp()
            ? <button className="small-button" onClick={props.onOpenNotificationSettings}>系统设置</button>
            : <button className="small-button" disabled={props.notificationBusy || props.notificationState !== 'default'} onClick={props.onEnableNotifications}>{props.notificationBusy ? '请求中…' : props.notificationState === 'denied' ? '已阻止' : '开启'}</button>}
      </div>
    </div>
    <div className="settings-group"><div className="settings-label">数据管理</div><div className="data-actions"><button onClick={props.onExportICS}><Download size={18} /><div><strong>导出日历</strong><span>标准 .ics 文件，可用于其他日历应用</span></div></button><button onClick={props.onExportJSON}><FileJson size={18} /><div><strong>备份全部数据</strong><span>包含日程、提醒事项与个性化标签</span></div></button><button onClick={() => fileRef.current?.click()}><Upload size={18} /><div><strong>恢复备份</strong><span>从日程中枢 JSON 备份恢复</span></div></button><input ref={fileRef} type="file" accept=".json,application/json" hidden onChange={(e) => { const file = e.target.files?.[0]; if (file) props.onImportJSON(file); e.target.value = '' }} /></div></div>
    <div className="settings-footer"><span><Check size={13} />更改会立即保存并应用</span><button className="text-danger" onClick={props.onReset}><RotateCcw size={14} />恢复示例数据</button></div>
  </DialogContent></Dialog>
}
