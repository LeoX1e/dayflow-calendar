# 日程中枢 Dayflow

一款 Apple 风格的本地优先日历与提醒事项应用，支持 AI / Agent 通过标准 JSON、一键导入链接和 iCalendar 文件导入日程。

## 运行

```bash
npm install
npm run dev -- --host 0.0.0.0 --port 7100
```

生产构建与检查：

```bash
npm run build
npm run lint
```

## macOS 原生版

在 Apple Silicon Mac 上构建：

```bash
npm run build:mac
```

构建产物：

- `macos/dist-mac/Dayflow.app`：原生应用包，建议通过 DMG 安装后使用。
- `macos/dist-mac/Dayflow-1.0.0-arm64.dmg`：包含应用与 Applications 快捷方式的安装镜像。

原生版复用同一套 React 界面，并使用 Swift、WKWebView 与 `UNUserNotificationCenter` 提供系统能力：

- 退出应用后仍由 macOS 送达已调度的日程和提醒，包括重复日程。
- 通知支持点击打开、稍后 10 分钟；提醒事项支持从通知中完成。
- 新建、编辑、改期、删除、AI 导入、备份恢复和完成状态都会自动同步通知计划。
- ICS 与 JSON 导出使用 macOS 原生“存储为”面板。
- 支持 `dayflow://` 一键导入链接。

首次使用请打开 DMG，将 Dayflow 拖入“应用程序”后运行，并在“设置与数据 → 通知”中允许系统通知。直接从 Documents 中受隔离的 `.app` 启动，可能受到 macOS App Translocation 与 AppleSystemPolicy 限制。

网页版与 macOS 版的数据分别保存在各自环境中，可通过 JSON 备份手动迁移；两者目前不会自动同步。当前安装包采用本地 ad-hoc 签名，未经过 Apple 公证，构建目标为 macOS 13（Apple Silicon），实际运行验收环境为 macOS 26。

## 已实现

- 全新 Dayflow SVG 标识与网站图标，月、周、日、列表日历视图，以及今日概览。
- 桌面月历采用 140px 高日期格，手机端自动适应可用高度。
- 日 / 周时间轴聚焦 07:00–21:00，时间轴外与跨日日程仍可查看和编辑。
- 日程新建、编辑、删除、重复规则、日历分类和筛选；普通日程可拖拽改期。
- 改期与删除日程 / 提醒事项后可在 5 秒内撤销。
- N / R / T / 1–4 / ? / Esc 键盘快捷键，输入和弹窗编辑时自动暂停。
- 提醒事项新建、编辑、完成、优先级、搜索和筛选。
- AI JSON 导入、导入预览、重复检测、时间冲突提示与批量导入。
- Base64URL 一键导入链接，标准 `.ics` 导入与导出。
- 网页版使用浏览器通知；macOS 版使用原生后台通知、稍后提醒与通知快捷操作。
- 浅色与深色外观。
- 自由创建自定义日历 / 标签，独立 ID、名称与颜色，删除时关联内容自动迁移到“工作”。
- 12 色扩展预设、原生自由取色器、6 位 HEX 精确输入，以及自动前景对比色。
- 日历标签名称与颜色自定义、44px 移动触控区域；恢复默认不会移除自定义日历。
- localStorage 本地持久化、包含个性化标签的 JSON 完整备份与恢复，AI 导入支持自定义日历 ID。
- 桌面和 375px 移动端自适应布局。

## 数据与边界

数据保存在当前浏览器或原生 WebView 的持久化 localStorage 中，不会上传。清理网站数据或卸载并删除应用数据会移除本地内容，请定期使用“设置与数据”中的备份功能。独立本地 API、MCP 服务、多设备自动同步和系统小组件仍属于后续规划。

## 技术与许可

- React、TypeScript、Vite、Tailwind CSS、Radix UI。
- 日期处理：date-fns（MIT）。
- iCalendar 解析与生成：ical.js（MPL-2.0）。
- 图标：Lucide（ISC）。

界面字体使用 Apple 系统字体与中文系统字体，不包含外部图片或字体资源。
