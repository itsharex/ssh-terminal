import { useState } from 'react'
import { ChevronLeft, ChevronRight, Maximize2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Dialog,
  DialogContent,
  DialogTrigger,
} from '@/components/ui/dialog'

const screenshots = [
  // 终端相关
  {
    src: '/ssh-terminal/screenshots/terminal-main.png',
    alt: '终端主界面',
    description: '支持多标签页的终端界面，深色主题'
  },
  {
    src: '/ssh-terminal/screenshots/terminal-nl-to-cmd.png',
    alt: '自然语言转命令',
    description: 'AI 智能助手将自然语言转换为 Shell 命令'
  },
  {
    src: '/ssh-terminal/screenshots/terminal-ai-short-page.png',
    alt: '终端 AI 助手',
    description: '快捷 AI 聊天面板，随时获取命令帮助'
  },

  // 会话与文件管理
  {
    src: '/ssh-terminal/screenshots/session-manager.png',
    alt: '会话管理',
    description: '卡片式会话管理，支持分组和快速连接'
  },
  {
    src: '/ssh-terminal/screenshots/sftp-manager.png',
    alt: 'SFTP 文件管理器',
    description: '双面板文件传输界面，支持远程文件操作'
  },

  // AI 聊天
  {
    src: '/ssh-terminal/screenshots/aichat-page.png',
    alt: 'AI 聊天页面',
    description: '独立的全屏 AI 对话界面，支持多轮对话和历史记录'
  },

  // 设置页面
  {
    src: '/ssh-terminal/screenshots/setting-main.png',
    alt: '设置主页',
    description: '设置中心，包含所有配置选项'
  },
  {
    src: '/ssh-terminal/screenshots/setting-terminal.png',
    alt: '终端设置',
    description: '丰富的终端配置选项：字体、光标、主题等'
  },
  {
    src: '/ssh-terminal/screenshots/setting-ai.png',
    alt: 'AI 设置',
    description: '配置 AI Provider、API Key 和模型参数'
  },
  {
    src: '/ssh-terminal/screenshots/setting-keybingdings.png',
    alt: '快捷键设置',
    description: '自定义快捷键绑定，提升操作效率'
  },
  {
    src: '/ssh-terminal/screenshots/setting-reacording.png',
    alt: '录制设置',
    description: '终端录制配置和导出选项'
  },
  {
    src: '/ssh-terminal/screenshots/setting-about.png',
    alt: '关于页面',
    description: '应用信息和版本说明'
  },

  // 录制管理
  {
    src: '/ssh-terminal/screenshots/recording-manager.png',
    alt: '录制管理器',
    description: '管理和回放终端录制内容'
  },
]

export function ScreenshotGallery() {
  const [currentIndex, setCurrentIndex] = useState(0)

  const nextScreenshot = () => {
    setCurrentIndex((prev) => (prev + 1) % screenshots.length)
  }

  const prevScreenshot = () => {
    setCurrentIndex((prev) => (prev - 1 + screenshots.length) % screenshots.length)
  }

  return (
    <section id="screenshots" className="py-24 bg-muted/50">
      <div className="container mx-auto px-4">
        <h2 className="text-4xl font-bold text-center mb-12">应用截图</h2>

        <div className="max-w-4xl mx-auto">
          {/* Main Image */}
          <div className="relative rounded-lg overflow-hidden border bg-background">
            <AnimatePresence mode="wait">
              <motion.img
                key={currentIndex}
                src={screenshots[currentIndex].src}
                alt={screenshots[currentIndex].alt}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="w-full h-auto max-h-[600px] object-contain mx-auto"
              />
            </AnimatePresence>

            {/* Navigation Buttons */}
            <Button
              variant="outline"
              size="icon"
              className="absolute left-4 top-1/2 -translate-y-1/2 bg-background/80 backdrop-blur hover:bg-background"
              onClick={prevScreenshot}
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>

            <Button
              variant="outline"
              size="icon"
              className="absolute right-4 top-1/2 -translate-y-1/2 bg-background/80 backdrop-blur hover:bg-background"
              onClick={nextScreenshot}
            >
              <ChevronRight className="h-5 w-5" />
            </Button>

            {/* Fullscreen Button */}
            <Dialog>
              <DialogTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  className="absolute right-4 top-4 bg-background/80 backdrop-blur hover:bg-background"
                >
                  <Maximize2 className="h-5 w-5" />
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-6xl">
                <img
                  src={screenshots[currentIndex].src}
                  alt={screenshots[currentIndex].alt}
                  className="w-full h-auto"
                />
              </DialogContent>
            </Dialog>
          </div>

          {/* Description */}
          <div className="text-center mt-6">
            <p className="text-muted-foreground mb-2">
              {screenshots[currentIndex].description}
            </p>
            <p className="text-xs text-muted-foreground">
              {currentIndex + 1} / {screenshots.length}
            </p>
          </div>

          {/* Thumbnails */}
          <div className="flex justify-center gap-2 mt-8 overflow-x-auto pb-4 px-4 max-w-full">
            {screenshots.map((shot, index) => (
              <button
                key={index}
                onClick={() => setCurrentIndex(index)}
                className={`rounded-lg overflow-hidden border-2 transition-all flex-shrink-0 ${
                  index === currentIndex
                    ? 'border-primary scale-105 shadow-lg'
                    : 'border-border hover:border-primary/50 opacity-60 hover:opacity-100'
                }`}
              >
                <img
                  src={shot.src}
                  alt={shot.alt}
                  className="w-20 h-14 object-cover"
                  title={shot.alt}
                />
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
