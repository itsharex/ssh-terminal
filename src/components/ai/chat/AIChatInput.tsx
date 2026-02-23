import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Send, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAIStore } from '@/store/aiStore';

interface AIChatInputProps {
  serverId: string;
}

export function AIChatInput({ serverId }: AIChatInputProps) {
  const { t } = useTranslation();
  const [input, setInput] = useState('');
  const [textareaHeight, setTextareaHeight] = useState('auto');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { sendMessage, isServerOnline, isLoading, error } = useAIStore();
  const isOnline = isServerOnline(serverId);

  // 计算行高的辅助函数
  const calculateHeight = useCallback(() => {
    if (!textareaRef.current) return 'auto';

    const textarea = textareaRef.current;
    const scrollHeight = textarea.scrollHeight;

    // 基础样式
    const lineHeight = 20; // 对应 text-sm 的行高
    const basePadding = 8; // 对应 p-2 的上下 padding
    const singleLineHeight = lineHeight + basePadding;

    // 最大行数：7行
    const maxLines = 7;
    const maxHeight = singleLineHeight * maxLines;

    // 如果内容高度小于等于最大高度，使用内容高度；否则使用最大高度并启用滚动
    const newHeight = Math.min(scrollHeight, maxHeight);

    return `${Math.max(newHeight, singleLineHeight)}px`;
  }, []);

  // 处理输入变化，自动调整高度
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    setInput(newValue);

    // 计算并设置新高度
    const newHeight = calculateHeight();
    setTextareaHeight(newHeight);
  };

  // 自动聚焦
  useEffect(() => {
    textareaRef.current?.focus();
  }, [serverId]);

  // 重置高度当清空输入时
  useEffect(() => {
    if (!input) {
      setTextareaHeight('auto');
    }
  }, [input]);

  // 处理发送消息
  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const messageToSend = input.trim();
    // 立即清空输入框
    setInput('');
    setTextareaHeight('auto');

    try {
      await sendMessage(serverId, messageToSend);
    } catch (error) {
      console.error('发送失败:', error);
      // 发送失败时恢复输入框内容
      setInput(messageToSend);
    }
  };

  // 处理键盘事件
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (input.trim() && !isLoading) {
        handleSend();
      }
    }
  };

  return (
    <div className="p-4 space-y-2">
      {/* 离线模式提示 */}
      {!isOnline && (
        <Alert variant="default" className="pt-4 pb-2 px-3 relative flex items-center gap-1.5 [&>svg]:static [&>svg]:mt-0.5 [&>svg~*]:pl-0">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <AlertDescription className="text-xs leading-normal">
            {t('ai.chat.inputOfflineHint')}
          </AlertDescription>
        </Alert>
      )}

      {/* 错误提示 */}
      {error && (
        <Alert variant="destructive" className="pt-4 pb-2 px-3 relative flex items-center gap-1.5 [&>svg]:static [&>svg]:mt-0.5 [&>svg~*]:pl-0">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <AlertDescription className="text-xs leading-normal">{error}</AlertDescription>
        </Alert>
      )}

      {/* 输入区域容器：带圆角边框 */}
      <div
        ref={containerRef}
        className="relative border border-gray-200 rounded-[28px] bg-background shadow-sm transition-all duration-200 focus-within:border-gray-500 focus-within:border-2"
        style={{
          minHeight: '44px',
          maxHeight: '300px',
        }}
      >
        <div className="flex items-end gap-2 p-2 pb-6">
          {/* 输入框 */}
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            autoComplete="off"
            placeholder={
              isOnline
                ? t('ai.chat.inputPlaceholderOnline')
                : t('ai.chat.inputPlaceholderOffline')
            }
            style={{
              height: textareaHeight,
              maxHeight: '224px', // 7行 × 32px/行 = 224px
            }}
            className="flex-1 min-h-[28px] resize-none bg-transparent border-0 p-0 text-sm focus-visible:outline-none focus-visible:ring-0 placeholder:text-muted-foreground overflow-y-auto custom-scrollbar"
          />

          {/* 发送按钮 */}
          <Button
            size="icon"
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="h-8 w-8 flex-shrink-0 rounded-full"
            variant="default"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>

        {/* 字符计数 */}
        <div className="absolute bottom-1.5 left-3 text-xs text-muted-foreground pointer-events-none">
          {t('ai.chat.inputCharacterCount', { count: input.length })}
        </div>
      </div>
    </div>
  );
}