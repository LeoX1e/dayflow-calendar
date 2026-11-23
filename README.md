# 日程中枢 Dayflow

一款 Apple 风格的本地优先日历与提醒事项应用，支持 AI / Agent 通过标准 JSON、一键导入链接和 iCalendar 文件导入日程。

## 下载与安装

### macOS 原生版（推荐）

**系统要求：Apple Silicon 芯片的 Mac，macOS 13 或更高版本。暂不支持 Intel Mac。**

1. 点击下载：[Dayflow 1.0.0 for Apple Silicon（DMG）](https://github.com/LeoX1e/dayflow-calendar/releases/download/v1.0.0/Dayflow-1.0.0-arm64.dmg)。也可以前往 [Releases 页面](https://github.com/LeoX1e/dayflow-calendar/releases) 查看最新版本。
2. 下载完成后，双击 `Dayflow-1.0.0-arm64.dmg`。
3. 在打开的窗口中，将 **Dayflow** 拖入 **Applications（应用程序）**。
4. 推出 DMG 磁盘映像，然后从“应用程序”文件夹打开 Dayflow。不要直接在 DMG 中运行，也建议不要从“文稿”等受隔离目录启动。
5. 首次使用时，在应用左下角进入 **设置与数据 → 通知**，点击“开启”，并在 macOS 弹窗中选择“允许”。可点击“测试”确认通知是否正常。
6. 如果之前拒绝过通知，请在同一位置点击“系统设置”，打开 Dayflow 的通知权限。

> **首次打开时的安全提示**
>
> 当前安装包使用本地 ad-hoc 签名，未经过 Apple 公证。如果 macOS 提示无法验证开发者，请在“访达 → 应用程序”中按住 Control 点击 Dayflow，选择“打开”，再在确认窗口中选择“打开”。如果仍被阻止，请前往“系统设置 → 隐私与安全性”，找到 Dayflow 的拦截提示并选择“仍要打开”。请只对本仓库 Releases 中下载的安装包执行此操作。

macOS 版使用系统通知。完成通知授权后，即使退出 Dayflow，已调度的日程和提醒仍可由 macOS 送达；通知支持点击打开、稍后 10 分钟，提醒事项也支持从通知中完成。

### 网页版

网页版需要从源码运行，不需要安装 macOS 应用。

**环境要求：Node.js 20.19+（或 22.12+）和 npm。**

1. 在仓库页面点击 **Code → Download ZIP** 并解压，或执行：

   ```bash
   git clone https://github.com/LeoX1e/dayflow-calendar.git
   cd dayflow-calendar
   ```

2. 安装依赖并启动：

   ```bash
   npm ci
   npm run dev -- --port 7100
   ```

3. 在浏览器中打开 [http://localhost:7100](http://localhost:7100)。
4. 如需浏览器通知，请进入 **设置与数据 → 通知** 开启权限。

网页版只在页面打开时检查到期提醒，关闭页面后不会提供后台通知。需要退出应用后仍接收提醒时，请使用 macOS 原生版。

### 从源码构建 macOS 安装包

适合需要检查源码或自行修改应用的开发者。构建时需要 Apple Silicon Mac、Swift 6 命令行工具、Node.js、Python 3 和 Pillow。

```bash
git clone https://github.com/LeoX1e/dayflow-calendar.git
cd dayflow-calendar
npm ci
python3 -m venv .venv
source .venv/bin/activate
python3 -m pip install Pillow
npm run build:mac
open macos/dist-mac
```

构建完成后会生成：

- `macos/dist-mac/Dayflow.app`：原生应用包。
- `macos/dist-mac/Dayflow-1.0.0-arm64.dmg`：包含应用与 Applications 快捷方式的安装镜像。

打开生成的 DMG，将 Dayflow 拖入“应用程序”即可安装。

## 使用指南

### 1. 日历与今日概览

- **今天**：集中查看今天的日程、待办和最近安排。
- **日历**：在月、周、日和列表视图之间切换，或使用快捷键 `1`–`4`。
- 按 `T` 返回今天；日／周时间轴主要显示 **07:00–21:00**，时间轴外和跨日日程仍可查看、编辑。
- 在“我的日历”中勾选或取消勾选分类，可以显示或隐藏对应内容。

### 2. 新建与管理日程

1. 按 `N`，或点击界面中的新建日程按钮。
2. 填写标题、开始和结束时间；可按需设置全天、重复规则、提醒、所属日历、地点和备注。
3. 点击“存储”。结束时间必须晚于开始时间。
4. 点击已有日程可编辑或删除；普通日程也可以拖拽改期。改期或删除后，可在 5 秒内撤销。

提醒时间支持日程开始时、提前 5／15／30 分钟、提前 1 小时、提前 1 天，或不提醒。

### 3. 新建与完成提醒事项

1. 进入 **提醒事项**，按 `R` 或点击新建按钮。
2. 填写内容、日期与时间，选择列表、优先级和备注，然后点击“存储”。
3. 点击事项左侧的圆圈即可标记完成；可使用搜索和筛选查找事项。
4. 点击已有事项可编辑或删除，删除后同样可在 5 秒内撤销。

### 4. 自定义日历与标签

进入 **设置与数据 → 日历与标签**：

- 点击“新建日历或标签”，输入名称并选择颜色。
- 点击已有分类的名称可直接重命名。
- 点击圆形色块可自由取色，也可选择 12 种预设颜色或输入任意 6 位 HEX 色值。
- 删除自定义分类后，关联的日程和提醒会迁移到“工作”。
- “恢复默认”只恢复内置分类的名称和配色，不会删除自定义分类。

### 5. 从任意 AI 或 Agent 导入日程

1. 打开 **AI 导入 → AI 内容**，点击“复制提示词”。
2. 将提示词和你的自然语言安排一起发送给 Kimi、ChatGPT、Claude 或自定义 Agent。
3. 复制 AI 返回的 JSON，粘贴到 Dayflow，点击“检查并预览”。
4. 检查重复日程和时间冲突，勾选需要的内容，点击“加入日历”。

标准格式示例：

```json
{
  "source": "Kimi",
  "events": [
    {
      "title": "产品评审",
      "start": "2026-12-01T10:00",
      "end": "2026-12-01T11:00",
      "calendar": "work",
      "location": "会议室 A",
      "notes": "准备评审材料",
      "reminder": 15,
      "repeat": "none"
    }
  ]
}
```

主要字段：

| 字段 | 说明 |
| --- | --- |
| `title` | 必填，日程标题。 |
| `start` | 必填，本地时间，建议使用 `YYYY-MM-DDTHH:mm`。 |
| `end` | 可选，结束时间；省略时默认持续 1 小时。 |
| `calendar` | 可选，分类 ID；未填写或无法识别时归入 `work`。 |
| `location`、`notes` | 可选，地点和备注。 |
| `allDay` | 可选，设为 `true` 表示全天日程。 |
| `reminder` | 可选，提前提醒的分钟数；`-1` 为不提醒，`0` 为开始时提醒，默认 `15`。 |
| `repeat` | 可选：`none`、`daily`、`weekly`、`monthly`、`yearly`。 |

也支持直接传入日程数组。应用内的“接入指南”提供完整提示词和一键导入链接说明；导入前始终会显示预览，不会静默修改日历。

### 6. 导入与导出日历文件

- **导入 ICS**：进入 **AI 导入 → 日历文件**，选择或拖入标准 `.ics` 文件，预览后确认导入。
- **导出 ICS**：进入 **设置与数据 → 数据管理 → 导出日历**，可用于其他支持 iCalendar 的日历应用。
- **完整备份**：点击“备份全部数据”，导出包含日程、提醒事项和个性化标签的 JSON 文件。
- **恢复备份**：点击“恢复备份”，选择由 Dayflow 导出的 JSON 文件。恢复会替换当前数据，操作前建议先另行备份。

macOS 版的 ICS 与 JSON 导出使用系统“存储为”面板。

### 7. 外观与快捷键

在 **设置与数据 → 外观** 中切换浅色或深色模式。

| 快捷键 | 功能 |
| --- | --- |
| `N` | 新建日程 |
| `R` | 新建提醒事项 |
| `T` | 返回今天 |
| `1` / `2` / `3` / `4` | 月／周／日／列表视图 |
| `?` | 查看快捷键 |
| `Esc` | 关闭弹窗 |

输入内容或编辑弹窗时，快捷键会自动暂停。

## 数据与隐私

- 数据保存在当前浏览器或原生 WebView 的持久化 localStorage 中，不需要账号，也不会主动上传。
- 网页版与 macOS 版的数据分别保存，目前不会自动同步；可通过 JSON 完整备份手动迁移。
- 清理浏览器网站数据，或卸载并删除应用数据，会移除本地内容。请定期备份。
- 独立本地 API、MCP 持续双向接入、多设备自动同步和系统小组件仍属于后续规划。

## 开发检查

```bash
npm run build
npm run lint
```

## 技术与许可

- React、TypeScript、Vite、Tailwind CSS、Radix UI。
- 日期处理：date-fns（MIT）。
- iCalendar 解析与生成：ical.js（MPL-2.0）。
- 图标：Lucide（ISC）。

界面字体使用 Apple 系统字体与中文系统字体，不包含外部图片或字体资源。
