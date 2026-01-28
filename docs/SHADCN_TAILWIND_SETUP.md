# shadcn/ui + Tailwind CSS 配置参考文档

本文档总结了 SSH Terminal 项目中 shadcn/ui 和 Tailwind CSS 的完整配置，方便在新项目中复用。

## 📋 目录

- [项目初始化](#项目初始化)
- [配置文件](#配置文件)
- [Tailwind CSS 配置](#tailwind-css-配置)
- [样式系统](#样式系统)
- [工具函数](#工具函数)
- [常用组件样式](#常用组件样式)
- [移动端优化](#移动端优化)
- [主题系统](#主题系统)

---

## 项目初始化

### 1. 安装依赖
> 这里推荐使用pnpm（或者强制推荐）

```bash
# 安装 shadcn/ui CLI
npm install -D @shadcn/ui@latest

# 或使用 pnpm
pnpm add -D @shadcn/ui@latest
```

### 2. 初始化 shadcn/ui

```bash
npx shadcn@latest init
```

### 3. components.json 配置

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "new-york",
  "rsc": false,
  "tsx": true,
  "tailwind": {
    "config": "",
    "css": "src/index.css",
    "baseColor": "neutral",
    "cssVariables": true,
    "prefix": ""
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/ui",
    "lib": "@/lib",
    "hooks": "@/hooks"
  },
  "iconLibrary": "lucide"
}
```

### 4. 安装 Tailwind CSS 4.0

```bash
npm install -D tailwindcss @tailwindcss/postcss
# 或
pnpm add -D tailwindcss @tailwindcss/postcss
```

### 5. 创建 postcss.config.js

```javascript
export default {
  plugins: {
    '@tailwindcss/postcss': {},
  },
}
```

---

## 配置文件

### tsconfig.json 路径别名

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

### vite.config.ts (Vite 项目)

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
```

---

## Tailwind CSS 配置

### tailwind.config.js

```javascript
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      // 移动端优先的断点配置
      screens: {
        'xs': '375px',   // 超小屏手机
        'sm': '640px',   // 小屏手机
        'md': '768px',   // 平板
        'lg': '1024px',  // 桌面
        'xl': '1280px',  // 大屏桌面
        '2xl': '1536px', // 超大屏
      },
      // 移动端友好的间距
      spacing: {
        'mobile-safe': 'env(safe-area-inset-bottom)',
      },
      // 移动端友好的圆角
      borderRadius: {
        'mobile': '12px',
      },
      // 移动端友好的阴影
      boxShadow: {
        'mobile': '0 2px 8px rgba(0, 0, 0, 0.1)',
      },
      // 移动端友好的动画
      transitionDuration: {
        '400': '400ms',
      },
    },
  },
  plugins: [],
}
```

---

## 样式系统

### src/index.css - 完整配置

```css
@import "tailwindcss";
@import "tw-animate-css";

@custom-variant dark (&:is(.dark *));

@theme {
  /* 移动端优先的断点配置 */
  --breakpoint-xs: 375px;
  --breakpoint-sm: 640px;
  --breakpoint-md: 768px;
  --breakpoint-lg: 1024px;
  --breakpoint-xl: 1280px;
  --breakpoint-2xl: 1536px;

  --radius-sm: calc(var(--radius) - 4px);
  --radius-md: calc(var(--radius) - 2px);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) + 4px);
  --radius-mobile: 12px;
  
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-destructive-foreground: var(--destructive-foreground);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);
  --color-chart-1: var(--chart-1);
  --color-chart-2: var(--chart-2);
  --color-chart-3: var(--chart-3);
  --color-chart-4: var(--chart-4);
  --color-chart-5: var(--chart-5);
  --color-sidebar: var(--sidebar);
  --color-sidebar-foreground: var(--sidebar-foreground);
  --color-sidebar-primary: var(--sidebar-primary);
  --color-sidebar-primary-foreground: var(--sidebar-primary-foreground);
  --color-sidebar-accent: var(--sidebar-accent);
  --color-sidebar-accent-foreground: var(--sidebar-accent-foreground);
  --color-sidebar-border: var(--sidebar-border);
  --color-sidebar-ring: var(--sidebar-ring);
}

:root {
  --radius: 0.625rem;
  --background: oklch(1 0 0);
  --foreground: oklch(0.145 0 0);
  --card: oklch(1 0 0);
  --card-foreground: oklch(0.145 0 0);
  --popover: oklch(1 0 0);
  --popover-foreground: oklch(0.145 0 0);
  --primary: oklch(0.205 0 0);
  --primary-foreground: oklch(0.985 0 0);
  --secondary: oklch(0.97 0 0);
  --secondary-foreground: oklch(0.205 0 0);
  --muted: oklch(0.97 0 0);
  --muted-foreground: oklch(0.556 0 0);
  --accent: oklch(0.97 0 0);
  --accent-foreground: oklch(0.205 0 0);
  --destructive: oklch(0.577 0.245 27.325);
  --destructive-foreground: oklch(0.985 0 0);
  --border: oklch(0.922 0 0);
  --input: oklch(0.922 0 0);
  --ring: oklch(0.708 0 0);
  --chart-1: oklch(0.646 0.222 41.116);
  --chart-2: oklch(0.6 0.118 184.704);
  --chart-3: oklch(0.398 0.07 227.392);
  --chart-4: oklch(0.828 0.189 84.429);
  --chart-5: oklch(0.769 0.188 70.08);
  --sidebar: oklch(0.985 0 0);
  --sidebar-foreground: oklch(0.145 0 0);
  --sidebar-primary: oklch(0.205 0 0);
  --sidebar-primary-foreground: oklch(0.985 0 0);
  --sidebar-accent: oklch(0.97 0 0);
  --sidebar-accent-foreground: oklch(0.205 0 0);
  --sidebar-border: oklch(0.922 0 0);
  --sidebar-ring: oklch(0.708 0 0);
}

.dark {
  --background: oklch(0.145 0 0);
  --foreground: oklch(0.985 0 0);
  --card: oklch(0.205 0 0);
  --card-foreground: oklch(0.985 0 0);
  --popover: oklch(0.205 0 0);
  --popover-foreground: oklch(0.985 0 0);
  --primary: oklch(0.922 0 0);
  --primary-foreground: oklch(0.205 0 0);
  --secondary: oklch(0.269 0 0);
  --secondary-foreground: oklch(0.985 0 0);
  --muted: oklch(0.269 0 0);
  --muted-foreground: oklch(0.708 0 0);
  --accent: oklch(0.269 0 0);
  --accent-foreground: oklch(0.985 0 0);
  --destructive: oklch(0.704 0.191 22.216);
  --destructive-foreground: oklch(0.985 0 0);
  --border: oklch(1 0 0 / 20%);
  --input: oklch(1 0 0 / 25%);
  --ring: oklch(0.556 0 0);
  --chart-1: oklch(0.488 0.243 264.376);
  --chart-2: oklch(0.696 0.17 162.48);
  --chart-3: oklch(0.769 0.188 70.08);
  --chart-4: oklch(0.627 0.265 303.9);
  --chart-5: oklch(0.645 0.246 16.439);
  --sidebar: oklch(0.205 0 0);
  --sidebar-foreground: oklch(0.985 0 0);
  --sidebar-primary: oklch(0.488 0.243 264.376);
  --sidebar-primary-foreground: oklch(0.985 0 0);
  --sidebar-accent: oklch(0.269 0 0);
  --sidebar-accent-foreground: oklch(0.985 0 0);
  --sidebar-border: oklch(1 0 0 / 10%);
  --sidebar-ring: oklch(0.556 0 0);
}

@layer base {
  * {
    @apply border-border outline-ring/50;
  }

  body {
    @apply bg-background text-foreground;
    font-family: Inter, Avenir, Helvetica, Arial, sans-serif;
    font-size: 16px;
    line-height: 24px;
    font-weight: 400;
    font-synthesis: none;
    text-rendering: optimizeLegibility;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    -webkit-text-size-adjust: 100%;
    -webkit-user-select: none;
    -moz-user-select: none;
    -ms-user-select: none;
    user-select: none;
    scroll-behavior: smooth;
  }

  /* 滚动条优化 */
  ::-webkit-scrollbar {
    width: 12px;
    height: 12px;
  }
  
  ::-webkit-scrollbar-track {
    background: var(--muted);
    border-radius: 6px;
  }
  
  ::-webkit-scrollbar-thumb {
    background: #000000;
    border-radius: 6px;
    border: 2px solid var(--muted);
    transition: background-color 0.2s ease;
  }
  
  ::-webkit-scrollbar-thumb:hover {
    background: #333333;
  }
  
  /* 深色模式滚动条 */
  .dark ::-webkit-scrollbar-thumb {
    background: #ffffff;
  }
  
  .dark ::-webkit-scrollbar-thumb:hover {
    background: #e0e0e0;
  }
  
  /* Firefox 滚动条 */
  * {
    scrollbar-width: thin;
    scrollbar-color: #000000 var(--muted);
  }
  
  .dark * {
    scrollbar-color: #ffffff var(--muted);
  }
}
```

---

## 工具函数

### src/lib/utils.ts

```typescript
import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

/**
 * 合并 Tailwind CSS 类名
 * 用于处理类名冲突和条件类名
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * 检测是否为移动端设备
 */
export function isMobileDevice(): boolean {
  if (typeof window === 'undefined') return false;
  
  const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera;
  const mobileRegex = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i;
  const isSmallScreen = window.innerWidth <= 768;
  
  return mobileRegex.test(userAgent) || isSmallScreen;
}

/**
 * 检测是否为平板设备
 */
export function isTablet(): boolean {
  if (typeof window === 'undefined') return false;
  
  const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera;
  const isIPad = /iPad/i.test(userAgent);
  const isAndroidTablet = /Android/i.test(userAgent) && !/Mobile/i.test(userAgent);
  const isMediumScreen = window.innerWidth > 768 && window.innerWidth <= 1024;
  
  return isIPad || isAndroidTablet || isMediumScreen;
}

/**
 * 检测是否支持触摸
 */
export function isTouchDevice(): boolean {
  if (typeof window === 'undefined') return false;
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
}
```

---

## 常用组件样式

### Button 组件样式规范

```typescript
// 默认按钮
<Button>默认按钮</Button>

// 主要按钮
<Button className="gap-2 items-center">
  <Icon className="h-5 w-5" />
  图标按钮
</Button>

// 大号按钮
<Button size="lg" className="gap-2 font-mono">
  <Icon className="h-5 w-5" />
  大号按钮
</Button>

// 链接按钮包装
<a href="#" className="inline-flex">
  <Button size="lg" className="gap-2 items-center">
    <Icon className="h-5 w-5" />
    按钮
  </Button>
</a>
```

### Card 组件样式规范

```typescript
<Card className="hover:shadow-xl transition-all duration-300 border hover:border-primary/30">
  <CardHeader>
    <CardTitle>标题</CardTitle>
    <CardDescription>描述</CardDescription>
  </CardHeader>
  <CardContent>
    内容
  </CardContent>
</Card>
```

### 焦点样式规范

```css
/* 所有元素默认焦点样式 */
* {
  @apply border-border outline-ring/50;
}

/* 自定义焦点样式 */
:focus-visible {
  outline: 2px solid var(--primary);
  outline-offset: 2px;
}
```

---

## 移动端优化

### 安全区域适配

```css
/* 刘海屏和底部手势条适配 */
.safe-area-top {
  padding-top: env(safe-area-inset-top);
}

.safe-area-bottom {
  padding-bottom: env(safe-area-inset-bottom);
}

.safe-area-left {
  padding-left: env(safe-area-inset-left);
}

.safe-area-right {
  padding-right: env(safe-area-inset-right);
}

.safe-area-all {
  padding-top: env(safe-area-inset-top);
  padding-bottom: env(safe-area-inset-bottom);
  padding-left: env(safe-area-inset-left);
  padding-right: env(safe-area-inset-right);
}
```

### 触摸优化

```css
/* 禁用触摸高亮 */
* {
  -webkit-tap-highlight-color: transparent;
  -webkit-touch-callout: none;
}

/* 优化触摸滚动 */
body {
  overscroll-behavior: none;
  -webkit-overflow-scrolling: touch;
  touch-action: manipulation;
}
```

### 移动端按钮点击区域

```css
@media (max-width: 428px) {
  button,
  a,
  [role="button"],
  .clickable {
    min-height: 44px;
    min-width: 44px;
  }
}
```

### 防止 iOS 自动缩放

```css
@media (max-width: 1024px) {
  body {
    font-size: 16px;
    -webkit-text-size-adjust: 100%;
  }

  input,
  textarea,
  select {
    font-size: 16px !important;
  }
}
```

---

## 主题系统

### 主题提供者

```tsx
import { ThemeProvider as NextThemesProvider } from 'next-themes'
import { type ComponentProps } from 'react'

export function ThemeProvider({ children, ...props }: ComponentProps<typeof NextThemesProvider>) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>
}
```

### 主题切换组件

```tsx
import { Moon, Sun } from 'lucide-react'
import { useTheme } from 'next-themes'
import { Button } from '@/components/ui/button'

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
    >
      <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
      <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
    </Button>
  )
}
```

### 使用主题

```tsx
import { ThemeProvider } from '@/components/theme-provider'

function App() {
  return (
    <ThemeProvider defaultTheme="dark" attribute="class">
      {/* 你的应用 */}
    </ThemeProvider>
  )
}
```

---

## 添加 shadcn/ui 组件

```bash
# 添加单个组件
npx shadcn@latest add button

# 添加多个组件
npx shadcn@latest add button card dialog input

# 查看所有可用组件
npx shadcn@latest add
```

---

## 最佳实践

### 1. 使用 cn() 函数合并类名

```tsx
import { cn } from '@/lib/utils'

// ✅ 推荐
<div className={cn('base-class', condition && 'conditional-class')} />

// ❌ 不推荐
<div className={`base-class ${condition ? 'conditional-class' : ''}`} />
```

### 2. 组件样式规范

```tsx
// ✅ 推荐：使用语义化的颜色变量
<div className="bg-background text-foreground border-border" />

// ❌ 不推荐：硬编码颜色
<div className="bg-white text-black border-gray-200" />
```

### 3. 响应式设计

```tsx
// ✅ 推荐：移动端优先
<div className="p-4 md:p-6 lg:p-8" />

// ❌ 不推荐：桌面端优先
<div className="p-8 lg:p-6 md:p-4" />
```

### 4. 边框样式

```tsx
// ✅ 推荐：使用 CSS 变量
<div className="border" />

// ❌ 不推荐：硬编码边框颜色
<div className="border-gray-200" />
```

---

## 故障排查

### 问题：Tailwind 类名不生效

**解决方案：**
1. 检查 `tailwind.config.js` 中的 `content` 配置是否包含所有文件
2. 清理缓存：`rm -rf node_modules/.cache`
3. 重新构建：`npm run build`

### 问题：深色模式不切换

**解决方案：**
1. 确保 `ThemeProvider` 包裹应用
2. 检查 `index.css` 中是否有 `.dark` 类定义
3. 确保 `vite.config.ts` 或 `tailwind.config.js` 中启用了 dark mode

### 问题：组件样式不一致

**解决方案：**
1. 确保使用 `@layer base` 定义基础样式
2. 使用 `cn()` 函数合并类名
3. 检查 CSS 变量是否正确定义

---

## 参考资源

- [shadcn/ui 文档](https://ui.shadcn.com/)
- [Tailwind CSS 文档](https://tailwindcss.com/)
- [next-themes 文档](https://github.com/pacocoursey/next-themes)
- [OKLCH 色彩空间](https://oklch.com/)

---

## 更新日志

- 2026-01-28: 初始版本，基于 SSH Terminal 项目配置
- 使用 Tailwind CSS 4.0 和 OKLCH 色彩系统
- 完整的移动端优化和主题系统