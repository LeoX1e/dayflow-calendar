import { Command, Keyboard } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'

const shortcuts = [
  { keys: ['N'], name: '新建日程', description: '在当前选中的日期创建日程' },
  { keys: ['R'], name: '新建提醒事项', description: '快速记录一件要做的事' },
  { keys: ['T'], name: '回到今天', description: '返回今天的日历' },
  { keys: ['1', '2', '3', '4'], name: '切换日历视图', description: '月、周、日、列表' },
  { keys: ['?'], name: '打开快捷键帮助', description: '随时查看这份清单' },
  { keys: ['Esc'], name: '关闭弹窗', description: '退出当前编辑或设置' },
]

export function ShortcutsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="schedule-dialog shortcuts-dialog">
    <DialogHeader><DialogTitle><Keyboard size={21} />键盘快捷键</DialogTitle><DialogDescription>不用离开键盘，也能快速安排一天。</DialogDescription></DialogHeader>
    <div className="shortcut-list">{shortcuts.map((shortcut) => <div className="shortcut-row" key={shortcut.name}><div><strong>{shortcut.name}</strong><span>{shortcut.description}</span></div><div className="shortcut-keys">{shortcut.keys.map((key) => <kbd key={key}>{key}</kbd>)}</div></div>)}</div>
    <div className="shortcut-note"><Command size={14} />输入内容时快捷键会自动暂停，不会干扰编辑。</div>
  </DialogContent></Dialog>
}
