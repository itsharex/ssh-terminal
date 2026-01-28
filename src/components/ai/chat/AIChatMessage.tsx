import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Bot, User } from 'lucide-react';
import type { ChatMessage } from '@/types/ai';

interface AIChatMessageProps {
  message: ChatMessage;
  isStreaming?: boolean;  // 是否正在流式生成此消息
}

export function AIChatMessage({ message, isStreaming }: AIChatMessageProps) {
  const isUser = message.role === 'user';
  const isEmpty = !message.content || message.content.trim().length === 0;

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} ${isStreaming ? 'animate-in fade-in slide-in-from-bottom-2 duration-300' : ''}`}>
      <div className={`flex gap-3 max-w-[80%] ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
        {/* 头像 */}
        <div className={`
          w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0
          ${isUser ? 'bg-primary' : isStreaming ? 'bg-primary/20' : 'bg-primary/10'}
          ${isStreaming && !isUser ? 'animate-pulse' : ''}
        `}>
          {isUser ? (
            <User className="h-4 w-4 text-primary-foreground" />
          ) : (
            <Bot className={`h-4 w-4 text-primary ${isStreaming ? 'animate-pulse' : ''}`} />
          )}
        </div>

        {/* 消息气泡 */}
        <div className={`
          rounded-2xl px-4 py-2.5 shadow-sm relative
          ${isUser
            ? 'bg-primary text-primary-foreground rounded-br-sm'
            : isStreaming
              ? 'bg-muted/80 text-foreground rounded-bl-sm border border-primary/20'
              : 'bg-muted text-foreground rounded-bl-sm border'
          }
          ${isStreaming && !isUser ? 'animate-in fade-in duration-200' : ''}
        `}>
          {isUser ? (
            // 用户消息：纯文本
            <p className="text-sm whitespace-pre-wrap break-words">
              {message.content}
            </p>
          ) : (
            // AI 消息：支持 Markdown
            <div className="text-sm prose prose-sm dark:prose-invert max-w-none">
              {isEmpty && isStreaming ? (
                // 空内容时显示占位符
                <div className="flex items-center gap-1">
                  <span className="w-1.5 h-1 bg-primary rounded-full animate-bounce [animation-delay:-0.3s]" />
                  <span className="w-1.5 h-1 bg-primary rounded-full animate-bounce [animation-delay:-0.15s]" />
                  <span className="w-1.5 h-1 bg-primary rounded-full animate-bounce" />
                </div>
              ) : (
                <>
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      // 代码块样式
                      pre: ({ node, ...props }) => (
                        <pre
                          className="bg-background rounded-md p-3 overflow-x-auto text-xs border border-border"
                          {...props}
                        />
                      ),
                      // 行内代码样式
                      code: ({ className, ...props }: any) =>
                        className?.includes('language-') ? (
                          <code className={className} {...props} />
                        ) : (
                          <code
                            className="bg-background rounded px-1.5 py-0.5 text-xs font-mono border border-border"
                            {...props}
                          />
                        ),
                    }}
                  >
                    {message.content}
                  </ReactMarkdown>

                  {/* 流式光标 - 增强版 */}
                  {isStreaming && !isEmpty && (
                    <span className="inline-flex items-center ml-1">
                      <span className="relative flex h-4 w-1.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary/40 opacity-75" />
                        <span className="relative inline-flex rounded-full h-4 w-1.5 bg-primary" />
                      </span>
                    </span>
                  )}
                </>
              )}
            </div>
          )}

          {/* 流式状态指示器 */}
          {isStreaming && !isUser && (
            <div className="absolute -bottom-1 -right-1">
              <span className="flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
