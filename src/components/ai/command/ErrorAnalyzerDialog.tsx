import { useState } from 'react';
import { AlertCircle, Sparkles, CheckCircle, XCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAIStore } from '@/store/aiStore';
import { toast } from 'sonner';
import { playSound, SoundEffect } from '@/lib/sounds';

interface ErrorAnalyzerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  errorText: string;
}

export function ErrorAnalyzerDialog({ open, onOpenChange, errorText }: ErrorAnalyzerDialogProps) {
  const { analyzeError, isLoading, config } = useAIStore();
  const [analysis, setAnalysis] = useState<string | null>(null);

  // 检查是否有可用的 AI Provider
  const hasEnabledProvider = config?.providers?.some((p: any) => p.enabled) ?? false;

  const handleAnalyze = async () => {
    if (!hasEnabledProvider) {
      toast.error('请先在设置中配置并启用 AI Provider');
      return;
    }

    try {
      const result = await analyzeError(errorText);
      setAnalysis(result);
      playSound(SoundEffect.SUCCESS);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : '分析失败';
      toast.error(`分析失败: ${errorMsg}`);
      playSound(SoundEffect.ERROR);
    }
  };

  const handleClose = () => {
    setAnalysis(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[85vh] min-h-[400px] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            AI 错误分析
          </DialogTitle>
          <DialogDescription>
            AI 会分析错误原因、提供解决方案并给出预防措施
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col gap-4">
          {/* 错误信息 */}
          <div className="bg-muted/50 rounded-lg p-4 border border-destructive/20">
            <div className="flex items-start gap-2 mb-2">
              <XCircle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
              <div className="flex-1 overflow-hidden">
                <p className="text-sm font-medium text-destructive mb-1">错误信息</p>
                <ScrollArea className="h-20 w-full rounded-md border border-destructive/10 bg-background">
                  <div className="p-3">
                    <pre className="text-xs whitespace-pre-wrap break-words font-mono">
                      {errorText}
                    </pre>
                  </div>
                </ScrollArea>
              </div>
            </div>
          </div>

          {/* 分析结果 */}
          {analysis ? (
            <div className="flex-1 overflow-hidden flex flex-col">
              <div className="flex items-start gap-2 mb-2">
                <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                <p className="text-sm font-medium text-green-600 dark:text-green-400">分析结果</p>
              </div>
              <ScrollArea className="flex-1 w-full rounded-md border border-border bg-background">
                <div className="p-4">
                  <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap">
                    {analysis}
                  </div>
                </div>
              </ScrollArea>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              {!isLoading && (
                <div className="text-center text-muted-foreground">
                  <AlertCircle className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p className="text-sm">点击下方按钮开始 AI 分析</p>
                </div>
              )}
              {isLoading && (
                <div className="text-center">
                  <div className="flex items-center justify-center gap-2 mb-3">
                    <div className="w-2 h-2 bg-primary rounded-full animate-bounce [animation-delay:-0.3s]" />
                    <div className="w-2 h-2 bg-primary rounded-full animate-bounce [animation-delay:-0.15s]" />
                    <div className="w-2 h-2 bg-primary rounded-full animate-bounce" />
                  </div>
                  <p className="text-sm text-muted-foreground">AI 正在分析错误...</p>
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
          {!analysis && (
            <Button
              onClick={handleAnalyze}
              disabled={isLoading || !hasEnabledProvider}
              className="gap-2"
            >
              <Sparkles className="h-4 w-4" />
              {isLoading ? '分析中...' : '开始分析'}
            </Button>
          )}
          {analysis && (
            <Button
              onClick={handleAnalyze}
              disabled={isLoading || !hasEnabledProvider}
              variant="secondary"
              className="gap-2"
            >
              <Sparkles className="h-4 w-4" />
              重新分析
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
