# 01-TRD 技术需求

**版本**：v0.1.0
**日期**：2026-08-06
**状态**：📝 草案，待审查
**上游**：docs/00 索引；参考：`H:\pi-references\pi`、`pi-skills`、`inno-agent`、`pi-desktop`

---

## 1. 项目定位

**pi-studybuddy = pi（AI 底座）+ pi-skills（组件供给）+ StudyBuddy 业务能力（内核）+ pi-desktop 式桌面壳（使用者介面）**

- 服务对象：一名在 Windows 本机学习的学生。
- 核心价值：把课程/考试目标、学习节奏、资料笔记、练习、错题和考前冲刺连成可持续闭环；家长接收脱敏异步摘要。
- 与 ai-studybuddy 的关系：**业务认知迁移、实现重构**。ai-studybuddy 已完成 S1-S7 原型验证（342 后端测试 + 149 前端测试 + 24 E2E 基线）；pi-studybuddy 以 pi 为底座重新组装，不复制其实现。

## 2. 技术底座（TRD 决策）

### 2.1 AI 底座：pi-coding-agent

| 决策 | 内容 |
|---|---|
| 内核 | `@earendil-works/pi-coding-agent`（npm，monorepo `packages/coding-agent`） |
| 铁律 | **不修改内核**；所有业务能力通过 `registerTool`、扩展（Extension）、技能（Skill）接入 |
| 运行时 | Node >= 20.6（本项目基线 Node 24，与 ai-studybuddy 部署基线一致） |
| 语言 | TypeScript（strict），ES modules |

**已确认的 pi 能力面**（从 `H:\pi-references\pi\packages\coding-agent\docs\` 核实）：
- `registerTool`（工具注册，inno-agent 用 `pi.registerTool(...)` 注册 OCR/文档/练习等工具）
- Extensions（`extensions.md`）：自定义生命周期钩子
- Skills（`skills.md`）：SKILL.md 按需加载的能力包
- Prompt templates / Themes（`prompt-templates.md`）
- MCP 工具接入
- `@earendil-works/pi-ai`：AI provider 抽象（多供应商可插拔）

### 2.2 组件供给：pi-skills + 自建技能

| 技能 | 来源 | 用途 |
|---|---|---|
| `transcribe` | badlogic/pi-skills | 音频转文字（ASR 补充） |
| `browser-tools` | badlogic/pi-skills | 浏览器自动化（备选） |
| `youtube-transcript` | badlogic/pi-skills | 视频讲义转写（备选） |
| 自建 `studybuddy-*` 系列 | 本项目 | 业务技能：格式转换、OCR 课表、TTS 朗读、练习生成等 |

技能治理：**下载储存 → 单件测试 → 集成测试 → 组装 → 系统冒烟/E2E**（docs/00 §四铁律）。

### 2.3 业务内核：StudyBuddy 能力迁移

从 ai-studybuddy 迁移**业务认知与数据模型**（不复制实现）：
- 考试驱动学习闭环：学期/课程/考试 → 资料笔记 → 知识模块 → 限时练习 → 错题改错 → 期末冲刺 → 家长报告
- 数据模型：global DB（学期注册表）+ 每学期独立 SQLite（semester.db）
- API 信封：`{ success, data, error }`
- 隐私边界：脱敏报告、AI 日志 allowlist、错误中文可操作且脱敏

### 2.4 使用者介面：参考 pi-desktop（Apache-2.0）

| 参考点 | pi-desktop 实现 | pi-studybuddy 采用 |
|---|---|---|
| 进程架构 | Electron 三进程：main / preload / renderer + agent-host | ✅ 采用 |
| IPC | `contract/` 类型化 IPC 契约 + RPC 层（TypeScript 约束） | ✅ 采用 |
| 安全 | `sandbox: true`、严格 CSP、preload 只暴露受控桥接 | ✅ 采用 |
| 内置浏览器 | Main-owned `WebContentsView`，远程网页不进 renderer | 可选（学生端以本机内容为主，浏览能力按需） |
| 会话管理 | 创建/切换/重命名/搜索/流式回复/工具调用视图 | ✅ 采用 |
| 技能管理 | 搜索/安装/配置 Skills、插件管理 | ✅ 采用 |
| 文件体验 | 项目目录/Git 分支/文件浏览/预览（Markdown/KaTeX/Mermaid/docx） | ✅ 采用 |
| 工具发现 | 发现验证 Node/Python/uv/Git/Bash，统一绝对路径执行环境 | ✅ 采用（OCR venv、whisper.cpp 依赖此） |

## 3. 格式矩阵（重构目标）

| 类别 | 格式 | 方案 |
|---|---|---|
| 文档 | pdf、docx、pptx | 复用 ai-studybuddy 已验证转换器（jszip/mammoth/pdf-parse），重新实现 |
| 文档 | **doc、ppt、xls**（旧二进制，常见课堂资料） | **WPS COM 转中间格式**（doc→docx、ppt→pptx、xls→xlsx）→ 现有管道。本机已装 WPS，零新依赖 |
| 表格 | xlsx、csv | xlsx：jszip 提取 sharedStrings；csv：文本直接 |
| 文本 | txt、md、json、html | 文本直接提取 |
| 图片 | jpg/jpeg/png/webp/gif/bmp/tiff | OCR venv（onnxruntime/PIL 原生支持全格式） |
| 办公衍生 | odt、ods、odp、rtf、epub | jszip 提取 / RTF 自写剥离 |
| 音频 | WAV（受控）→ whisper.cpp | S7-MVP 底座迁移；扩展 mp3/m4a 经 ffmpeg 转 WAV（备选） |
| TTS | 文字朗读 | Windows SAPI（系统自带）或 edge-tts（可选），封装为 skill |
| 拒绝 | 压缩包、邮件、宏文档（xlsm/docm/pptm） | 明确提示，不解析 |

> 关键决策记录：**不引入 SheetJS**（npm `xlsx@0.18.5` 有 CVE-2023-30533/CVE-2023-22365 且 registry 停更）；doc/ppt/xls 用 WPS COM 转换而非自行解析二进制。

## 4. 系统形态（重构范围）

| 形态 | 技术 | 优先级 |
|---|---|---|
| 桌面应用 | Electron（pi-desktop 架构） | P0（学生本机主入口） |
| Web UI（可选） | React（inno-agent 有 React 19 + Tailwind 4 参考） | P1 |
| 终端 CLI | pi TUI 原生（`pi` 命令 + 项目内 skill） | P1（开发/调试用） |

## 5. 安全与隐私边界

- 只监听 `127.0.0.1`；无公网入口、无云数据库。
- 真实密钥只在本机配置存储（Windows DPAPI，参考 ai-studybuddy T08 配置中心 + pi-desktop credential-vault）。
- 日志脱敏：不记录请求正文、模型完整输出、base URL、key、完整 UUID；AI 日志字段 allowlist。
- 学生资料原文、考试名称、家长渠道地址默认敏感。
- 组件安全：zip 炸弹防护（条目/解压比限制）、MIME 严格匹配、不执行嵌入代码。

## 6. 组件治理与本项目关系

五阶段组件治理（docs/00 §四）是本项目所有组件的强制流程：
- ai-studybuddy 已验证组件（转换器、OCR、whisper.cpp 集成、报告生成）：以"迁移组件"身份仍需走单件测试（在新仓库环境验证 Node 24 + WPS COM + venv）。
- 新组件（WPS COM 桥、TTS、pi-desktop 桌面壳）：严格走五阶段。

## 7. 待办决策（TRD 审查点）

1. WPS COM 桥：直接 node 调用（`node-windows`/COM interop）还是 Python `pywin32` 子进程？→ 倾向 Python（OCR venv 已有 Python 运行时，pywin32 成熟）。
2. 桌面壳：直接 fork pi-desktop（Apache-2.0 合法）还是取其架构自建？→ 倾向取架构自建业务化壳，避免携带无关功能。
3. 会话与业务数据边界：pi 会话目录（`~/.pi`）与业务数据根（`%LOCALAPPDATA%\PiStudyBuddy`）物理隔离。
4. TTS 引擎选型：SAPI（零依赖）vs edge-tts（音质好、需网络）。
5. 文档系统语言：中文优先（与 ai-studybuddy 一致）。

## 8. 下一步

- 02-PRD：产品需求（业务闭环定义）
- 03-Architecture：pi 扩展层 / 业务 Adapter / 数据层 / 技能体系设计
- 09-UI：使用者介面设计（基于 pi-desktop 架构决策）
