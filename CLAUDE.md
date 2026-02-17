# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

SSH Terminal 是一个基于 Tauri 2.0 + React 19 的现代化 SSH 终端客户端应用。项目采用前后端分离架构：
- **前端**: React 19 + TypeScript + Vite + Tailwind CSS 4.0 + shadcn/ui
- **后端**: Rust + Tauri 2.0，使用 russh 作为纯 Rust SSH 实现（支持所有平台包括 Android）

## 常用命令

### 依赖安装
```bash
pnpm install
```

### 开发模式
```bash
# 启动完整应用（前端 + 后端）
pnpm tauri dev

# 仅前端开发（端口 1420）
pnpm dev
```

### 代码检查
```bash
# 前端构建检查
pnpm build

# Rust 端检查
cd src-tauri && cargo check
```

### 生产构建
```bash
# 桌面端构建
pnpm tauri build

# Android 构建（需要配置 Android SDK）
pnpm tauri:android:release:arm64
pnpm tauri:android:release:x86_64
pnpm tauri:android:release:universal
```

### 添加 shadcn/ui 组件
```bash
npx shadcn@latest add [component-name]
```

## 核心架构概念

### 三层实体模型
项目采用三个核心概念来管理 SSH 连接：

1. **Session（会话配置）** - 保存的 SSH 连接配置，包含主机、端口、认证信息等
2. **Connection（连接实例）** - 基于 Session 创建的实际 SSH 连接，一个 Session 可以创建多个 Connection
3. **TerminalTab（终端标签页）** - 前端展示的终端标签，每个标签对应一个 Connection

### SSH 后端架构

项目使用统一的 SSH 后端抽象（`SSHBackend` trait），所有平台默认使用 `RusshBackend`：

```
src-tauri/src/ssh/
├── backend.rs          # SSHBackend trait 定义
├── manager.rs          # SSHManager（管理 Session 和 Connection）
├── session.rs          # Session 配置和 AuthMethod
├── connection.rs       # SSH 连接实例
└── backends/
    ├── mod.rs          # 后端模块声明
    ├── russh.rs        # RusshBackend（纯 Rust 实现，所有平台）
    └── sftp_channel.rs # SFTP channel 包装器
```

**重要**：所有平台（包括 Android）统一使用 russh 作为 SSH 后端实现。

### 前端状态管理

使用 Zustand 进行状态管理，主要 store：
- `sessionStore.ts` - 会话配置管理
- `terminalStore.ts` - 终端实例和标签页管理
- `terminalConfigStore.ts` - 终端配置（主题、字体等）
- `aiStore.ts` - AI 功能状态
- `sftpStore.ts` - SFTP 文件管理状态
- `keybindingStore.ts` - 快捷键绑定
- `recordingStore.ts` - 录制管理

### Tauri 命令注册

所有 Tauri 命令在 `src-tauri/src/lib.rs` 的 `invoke_handler` 中注册。添加新命令时需要：
1. 在 `src-tauri/src/commands/` 中创建命令函数
2. 使用 `#[tauri::command]` 宏标记
3. 在 `lib.rs` 的 `invoke_handler![...]` 中注册

### AI 功能架构

AI 功能采用 Provider 模式，支持多个 AI 服务商（OpenAI、Claude、DeepSeek）：
- **AI Provider 缓存池**：自动缓存和复用 Provider 实例，提升性能
- **配置热重载**：配置更改时自动清理旧缓存
- **流式响应**：支持 AI 流式输出（`ai_chat_stream`）

AI 配置通过 `AIConfigManager` 管理，保存配置时自动触发热重载。

## 代码规范

### 命名规范（重要）

项目使用自动化的命名转换，详见 `docs/Tauri_Naming_Conventions.md`：

**Rust 端**：
- 结构体/枚举：PascalCase（如 `SessionConfig`）
- 字段/变量：snake_case（如 `user_name`）
- 添加 `#[serde(rename_all = "camelCase")]` 自动转换为 camelCase

**前端 TypeScript**：
- 类型：PascalCase（如 `SessionConfig`）
- 字段/变量：camelCase（如 `userName`）

**示例**：
```rust
// Rust
#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionConfig {
    pub user_name: String,
    pub private_key_path: String,
}
```

```typescript
// TypeScript
export interface SessionConfig {
    userName: string;
    privateKeyPath: string;
}
```

### 前端规范

- **组件命名**：PascalCase（如 `MainLayout.tsx`）
- **文件命名**：PascalCase（组件）、camelCase（工具函数）
- **导入顺序**：React 相关 → 第三方库 → 本地组件（使用 `@/` 别名）→ 本地工具
- **UI 组件**：优先使用 `src/components/ui/` 中的 shadcn/ui 组件
- **状态管理**：使用 Zustand，遵循单一数据源原则

### 后端规范

- **命名**：遵循 Rust 标准（类型 PascalCase，函数 snake_case）
- **错误处理**：使用 `Result<T, E>` 和自定义错误类型（`error.rs`）
- **异步编程**：使用 `async/await` + tokio
- **Tauri 命令**：参数和返回值必须实现 `serde::Serialize/Deserialize`

## 关键文件位置

### 前端核心文件
```
src/
├── App.tsx                    # 主应用组件，路由定义
├── main.tsx                   # 应用入口
├── components/
│   ├── layout/                # 布局组件（MainLayout, Sidebar, TopBar）
│   ├── terminal/              # 终端组件（XTermWrapper, TabBar）
│   ├── session/               # 会话管理组件
│   ├── ai/                    # AI 功能组件
│   ├── ssh/                   # SSH 相关组件
│   ├── sftp/                  # SFTP 文件管理
│   └── ui/                    # shadcn/ui 基础组件
├── pages/                     # 页面组件
├── store/                     # Zustand store
├── types/                     # TypeScript 类型定义
└── lib/                       # 工具函数和 AI 服务
```

### 后端核心文件
```
src-tauri/src/
├── lib.rs                     # 应用入口，Tauri setup，命令注册
├── main.rs                    # main 函数入口
├── commands/                  # Tauri 命令实现
│   ├── mod.rs
│   ├── session.rs             # 会话管理命令
│   ├── terminal.rs            # 终端操作命令
│   ├── storage.rs             # 持久化命令
│   ├── sftp.rs                # SFTP 命令
│   ├── ai.rs                  # AI 命令
│   └── ai_history.rs          # AI 对话历史命令
├── ssh/                       # SSH 管理核心
├── config/                    # 配置管理
├── error.rs                   # 错误类型定义
└── Cargo.toml                 # Rust 依赖配置
```

## 开发注意事项

### SSH 后端切换
项目已统一使用 russh 后端，不再支持 system_ssh 后端。如需修改 SSH 实现，编辑 `src-tauri/src/ssh/backends/mod.rs`。

### 加密存储
会话密码和密钥使用 AES-256-GCM 加密存储，加密逻辑在 `src-tauri/src/config/storage.rs`。

### 终端主题
主题配置在 `src/config/themes.ts`，支持 8 种预设主题。

### 移动端适配
- 响应式布局使用 `MobileLayout` 组件
- 移动端特有组件在 `src/components/mobile/`
- Android 构建需要配置 Android SDK 和 NDK

### AI 配置热重载
保存 AI 配置时自动触发热重载，清理相关 Provider 缓存。如需手动重载：
```typescript
import { AICacheManager } from '@/lib/ai';
await AICacheManager.hotReload();
```

### 日志系统
后端使用 tracing，默认关闭 russh 调试日志。可通过环境变量控制：
```bash
RUST_LOG=ssh_terminal=debug,russh=off pnpm tauri dev
```

## 调试技巧

### 前端调试
- 开发模式自动打开 DevTools
- React DevTools 浏览器扩展

### 后端调试
```bash
# 查看 Rust 日志
RUST_LOG=debug pnpm tauri dev

# 仅查看应用日志（关闭 russh 日志）
RUST_LOG=ssh_terminal=info,russh=off pnpm tauri dev
```

### 类型检查
```bash
# 前端
pnpm tsc --noEmit

# 后端
cd src-tauri && cargo clippy
```

## 相关文档

- [快捷键列表](./docs/Shortcuts.md)
- [Tauri 命名规范](./docs/Tauri_Naming_Conventions.md)
- [AI 缓存池集成](./docs/ai-cache-integration.md)
- [如何添加快捷键](./docs/HOW_TO_ADD_KEYBINDING.md)
