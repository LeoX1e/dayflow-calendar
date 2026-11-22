import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, ArrowRight, Bot, Braces, Calendar, CalendarCheck, Check, CheckCircle2, Copy, Link2, ShieldCheck, Sparkles, UploadCloud } from 'lucide-react'
import { toast } from 'sonner'
import type { ImportEventPayload, ImportPayload, ScheduleEvent } from '@/types'
import { useCalendars } from '@/hooks/useCalendars'
import { createAgentPrompt, encodeImportLink, formatSmartDate, hasConflict, isDuplicate, normalizeImport, parseICS, SAMPLE_IMPORT, toScheduleEvent } from '@/lib/schedule'

interface Props {
  events: ScheduleEvent[]
  pendingPayload: ImportPayload | null
  onConsumePending: () => void
  onImport: (events: ScheduleEvent[]) => void
}

type InputTab = 'json' | 'ics' | 'guide'

async function copyText(text: string, message: string) {
  await navigator.clipboard.writeText(text)
  toast.success(message)
}

export function ImportView({ events, pendingPayload, onConsumePending, onImport }: Props) {
  const CALENDARS = useCalendars()
  const agentPrompt = createAgentPrompt(CALENDARS)
  const [tab, setTab] = useState<InputTab>('json')
  const [text, setText] = useState('')
  const [items, setItems] = useState<ImportEventPayload[]>([])
  const [source, setSource] = useState('AI Assistant')
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [error, setError] = useState('')
  const [fileName, setFileName] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  function loadPayload(payload: ImportPayload) {
    try {
      const normalized = normalizeImport(payload, CALENDARS)
      setItems(normalized)
      setSource(payload.source || 'AI Assistant')
      setSelected(new Set(normalized.map((item, index) => isDuplicate(item, events) ? -1 : index).filter((index) => index >= 0)))
      setError('')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '无法识别这份日程内容')
      setItems([])
    }
  }

  useEffect(() => {
    if (pendingPayload) {
      loadPayload(pendingPayload)
      setTab('json')
      onConsumePending()
    }
    // Only a new deep-link payload should trigger this loader.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingPayload])

  function parseText() {
    try {
      const parsed = JSON.parse(text) as ImportPayload | ImportEventPayload[]
      loadPayload(Array.isArray(parsed) ? { source: 'AI Assistant', events: parsed } : parsed)
    } catch {
      setError('JSON 格式不完整，请检查括号、引号和时间格式')
    }
  }

  async function readICS(file: File) {
    try {
      const content = await file.text()
      const parsed = parseICS(content)
      setFileName(file.name)
      loadPayload({ source: file.name, events: parsed })
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '无法读取这个日历文件')
    }
  }

  function toggle(index: number) {
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(index)) next.delete(index); else next.add(index)
      return next
    })
  }

  function confirmImport() {
    const chosen = items.filter((_, index) => selected.has(index)).map((item) => toScheduleEvent({ ...item, calendar: item.calendar && Object.hasOwn(CALENDARS, item.calendar) ? item.calendar : 'work' }, source))
    if (!chosen.length) return
    onImport(chosen)
    setItems([])
    setSelected(new Set())
    setText('')
    setFileName('')
  }

  return <div className="import-view page-scroll">
    <div className="content-heading import-heading"><div><div className="ai-title-icon"><Sparkles size={22} /></div><h1>从 AI 到日历，只差一次确认。</h1><p>让 Kimi、ChatGPT、Claude 或你的 Agent 用统一格式安排日程。</p></div><div className="privacy-note"><ShieldCheck size={16} />导入前预览，不会静默修改日程</div></div>
    <div className="import-source-row"><span>适用于</span>{['Kimi', 'ChatGPT', 'Claude', '自定义 Agent'].map((name) => <div key={name}><Bot size={14} />{name}</div>)}</div>
    <div className="import-tabs" role="tablist"><button role="tab" aria-selected={tab === 'json'} className={tab === 'json' ? 'active' : ''} onClick={() => setTab('json')}><Braces size={16} />AI 内容</button><button role="tab" aria-selected={tab === 'ics'} className={tab === 'ics' ? 'active' : ''} onClick={() => setTab('ics')}><Calendar size={16} />日历文件</button><button role="tab" aria-selected={tab === 'guide'} className={tab === 'guide' ? 'active' : ''} onClick={() => setTab('guide')}><Link2 size={16} />接入指南</button></div>

    {items.length > 0 ? <section className="import-preview">
      <div className="preview-header"><div><span className="source-icon"><Sparkles size={19} /></span><div><h2>导入预览</h2><p>来自 {source} · 共 {items.length} 项日程</p></div></div><button className="text-button" onClick={() => { setItems([]); setSelected(new Set()); setError('') }}>返回编辑</button></div>
      <div className="preview-notice"><CheckCircle2 size={17} /><span>已检查重复日程和时间冲突。请选择要加入日历的内容。</span></div>
      <div className="preview-list">{items.map((item, index) => {
        const duplicate = isDuplicate(item, events)
        const conflict = !duplicate && hasConflict(item, events)
        const calendar = CALENDARS[item.calendar || 'work'] || CALENDARS.work
        return <label key={`${item.title}-${index}`} className={`preview-item ${selected.has(index) ? 'selected' : ''} ${duplicate ? 'duplicate' : ''}`}>
          <input type="checkbox" checked={selected.has(index)} disabled={duplicate} onChange={() => toggle(index)} aria-label={`选择 ${item.title}`} />
          <span className="preview-checkbox">{selected.has(index) && <Check size={14} />}</span>
          <span className="preview-calendar-dot" style={{ background: calendar.color }} />
          <div className="preview-item-copy"><div><strong>{item.title}</strong>{duplicate && <span className="status-badge neutral">已存在</span>}{conflict && <span className="status-badge warning"><AlertTriangle size={11} />时间冲突</span>}</div><p>{formatSmartDate(item.start)} – {new Intl.DateTimeFormat('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(item.end || item.start))}{item.location && ` · ${item.location}`}</p><span>{calendar.name}{item.allDay ? ' · 全天' : ` · 提前 ${item.reminder ?? 15} 分钟提醒`}</span></div>
        </label>
      })}</div>
      <div className="preview-actions"><button className="secondary-button" onClick={() => copyText(encodeImportLink({ source, events: items }), '导入链接已复制')}><Link2 size={16} />复制一键导入链接</button><div><span>已选择 {selected.size} 项</span><button className="primary-button" disabled={!selected.size} onClick={confirmImport}>加入日历<ArrowRight size={16} /></button></div></div>
    </section> : <>
      {tab === 'json' && <div className="import-workspace"><section className="json-input-section"><div className="section-title-row"><div><h2>粘贴 AI 生成的日程</h2><p>支持单个日程或包含 events 数组的 JSON。</p></div><button className="text-button" onClick={() => { setText(JSON.stringify(SAMPLE_IMPORT, null, 2)); setError('') }}>试用示例</button></div><textarea className="json-textarea" value={text} onChange={(e) => setText(e.target.value)} placeholder={'{\n  "source": "Kimi",\n  "events": [\n    {\n      "title": "产品评审",\n      "start": "2026-11-23T10:00",\n      "end": "2026-11-23T11:00"\n    }\n  ]\n}'} spellCheck={false} aria-label="AI 日程 JSON" />{error && <p className="form-error" role="alert">{error}</p>}<div className="json-actions"><button className="secondary-button" onClick={() => copyText(agentPrompt, 'Agent 提示词已复制')}><Copy size={15} />复制提示词</button><button className="primary-button" disabled={!text.trim()} onClick={parseText}>检查并预览<ArrowRight size={16} /></button></div></section><aside className="import-how"><span className="how-icon"><Bot size={24} /></span><h3>三步完成安排</h3><ol><li><span>1</span><div><strong>让 AI 整理日程</strong><p>复制提示词，交给任意 AI 或 Agent。</p></div></li><li><span>2</span><div><strong>粘贴或打开链接</strong><p>统一识别标题、时间、地点与提醒。</p></div></li><li><span>3</span><div><strong>确认后加入日历</strong><p>自动检查冲突，导入后立即生效。</p></div></li></ol></aside></div>}
      {tab === 'ics' && <section className="file-import-section"><button className="file-dropzone" onClick={() => fileRef.current?.click()} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); const file = e.dataTransfer.files[0]; if (file) readICS(file) }}><span><UploadCloud size={30} /></span><h2>选择或拖入日历文件</h2><p>支持标准 .ics 文件，可批量导入多个日程</p><span className="small-button">选择文件</span></button><input ref={fileRef} type="file" accept=".ics,text/calendar" hidden onChange={(e) => { const file = e.target.files?.[0]; if (file) readICS(file); e.target.value = '' }} />{fileName && <p className="selected-file"><Calendar size={15} />{fileName}</p>}{error && <p className="form-error" role="alert">{error}</p>}<div className="file-format-note"><CalendarCheck size={20} /><div><strong>开放格式，不被平台锁定</strong><p>遵循 iCalendar 标准。你也可以随时从“设置与数据”导出自己的日历。</p></div></div></section>}
      {tab === 'guide' && <div className="integration-guide"><section><h2>给任意 AI 或 Agent 的标准格式</h2><p>复制下面的提示词，让 AI 直接生成兼容内容。无需为不同平台维护私有格式。</p><button className="primary-button" onClick={() => copyText(agentPrompt, 'Agent 提示词已复制')}><Copy size={16} />复制 Agent 提示词</button><pre>{agentPrompt}</pre></section><aside><h3>一键导入链接</h3><p>Agent 可将同样的 JSON 编码到 <code>?import=</code> 参数中。用户打开链接后会先看到预览，再确认导入。</p><div className="guide-security"><ShieldCheck size={18} /><span>链接只包含日程内容，不需要账号或访问密钥。</span></div><h3>本地与后台提醒</h3><p>网页版在页面打开时检查通知；macOS 版会将日程与提醒同步到系统通知，退出应用后仍可送达。`.ics` 与 JSON 导入均已可用，MCP 等持续双向接入属于后续规划。</p></aside></div>}
    </>}
  </div>
}
