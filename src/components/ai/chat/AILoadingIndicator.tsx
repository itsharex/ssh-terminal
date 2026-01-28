import { Bot } from 'lucide-react';

export function AILoadingIndicator() {
  return (
    <div className="flex justify-start">
      <div className="flex gap-3 max-w-[80%]">
        {/* AI 头像 */}
        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
          <Bot className="h-4 w-4 text-primary animate-pulse" />
        </div>

        {/* 加载气泡 */}
        <div className="bg-muted rounded-2xl rounded-bl-sm px-4 py-3 border">
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 bg-foreground/60 rounded-full animate-bounce [animation-delay:-0.3s]" />
            <div className="w-2 h-2 bg-foreground/60 rounded-full animate-bounce [animation-delay:-0.15s]" />
            <div className="w-2 h-2 bg-foreground/60 rounded-full animate-bounce" />
          </div>
        </div>
      </div>
    </div>
  );
}
