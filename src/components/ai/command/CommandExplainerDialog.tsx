import { useState } from 'react';
import { Sparkles, CheckCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAIStore } from '@/store/aiStore';
import { toast } from 'sonner';
import { playSound, SoundEffect } from '@/lib/sounds';

interface CommandExplainerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  command: string;
}

export function CommandExplainerDialog({ open, onOpenChange, command }: CommandExplainerDialogProps) {
  const { explainCommand, isLoading, config } = useAIStore();
  const [explanation, setExplanation] = useState<string | null>(null);

  // 检查是否有可用的 AI Provider
  const hasEnabledProvider = config?.providers?.some((p: any) => p.enabled) ?? false;

  const handleExplain = async () => {
    if (!hasEnabledProvider) {
      toast.error('请先在设置中配置并启用 AI Provider');
      return;
    }

    try {
      const result = await explainCommand(command);
      setExplanation(result);
      playSound(SoundEffect.SUCCESS);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : '解释失败';
      toast.error(`解释失败: ${errorMsg}`);
      playSound(SoundEffect.ERROR);
    }
  };

  const handleClose = () => {
    setExplanation(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[85vh] min-h-[400px] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            AI 命令解释
          </DialogTitle>
          <DialogDescription>
            AI 会解释选中命令的功能、参数、使用场景和风险提示
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col gap-4">
          {/* 命令信息 */}
          <div className="bg-muted/50 rounded-lg p-4 border border-primary/20">
            <div className="flex items-start gap-2 mb-2">
              <div className="flex-1 overflow-hidden">
                <p className="text-sm font-medium text-primary mb-1">待解释的命令</p>
                <ScrollArea className="h-20 w-full rounded-md border border-primary/10 bg-background">
                  <div className="p-3">
                    <code className="text-xs whitespace-pre-wrap break-words font-mono text-primary">
                      {command}
                    </code>
                  </div>
                </ScrollArea>
              </div>
            </div>
          </div>

          {/* 解释结果 */}
          {explanation ? (
            <div className="flex-1 overflow-hidden flex flex-col">
              <div className="flex items-start gap-2 mb-2">
                <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                <p className="text-sm font-medium text-green-600 dark:text-green-400">解释结果</p>
              </div>
              <ScrollArea className="flex-1 w-full rounded-md border border-border bg-background">
                <div className="p-4">
                  <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap">
                    {explanation}
                  </div>
                </div>
              </ScrollArea>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              {!isLoading && (
                <div className="text-center text-muted-foreground">
                  <Sparkles className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p className="text-sm">点击下方按钮开始 AI 解释</p>
                </div>
              )}
              {isLoading && (
                <div className="text-center">
                  <div className="flex items-center justify-center gap-2 mb-3">
                    <div className="w-2 h-2 bg-primary rounded-full animate-bounce [animation-delay:-0.3s]" />
                    <div className="w-2 h-2 bg-primary rounded-full animate-bounce [animation-delay:-0.15s]" />
                    <div className="w-2 h-2 bg-primary rounded-full animate-bounce" />
                  </div>
                  <p className="text-sm text-muted-foreground">AI 正在解释命令...</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 底部按钮 */}
        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isLoading}
          >
            关闭
          </Button>
          {!explanation && (
            <Button
              onClick={handleExplain}
              disabled={isLoading || !hasEnabledProvider}
              className="gap-2"
            >
              <Sparkles className="h-4 w-4" />
              {isLoading ? '解释中...' : '开始解释'}
            </Button>
          )}
          {explanation && (
            <Button
              onClick={handleExplain}
              disabled={isLoading || !hasEnabledProvider}
              variant="secondary"
              className="gap-2"
            >
              <Sparkles className="h-4 w-4" />
              重新解释
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
