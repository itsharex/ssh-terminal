import { useState } from 'react';
import { AlertCircle, Loader2, CheckCircle, Server, HardDrive } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useSyncStore } from '@/store/syncStore';
import type { ConflictInfo } from '@/types/sync';
import { playSound } from '@/lib/sounds';
import { SoundEffect } from '@/lib/sounds';

interface ConflictResolverProps {
  isOpen: boolean;
  onClose: () => void;
  conflicts?: ConflictInfo[];
}

export function ConflictResolver({ isOpen, onClose, conflicts = [] }: ConflictResolverProps) {
  const { resolveConflict, isResolving, error, clearError } = useSyncStore();
  const [selectedStrategy, setSelectedStrategy] = useState<Record<string, string>>({});
  const [currentConflictIndex, setCurrentConflictIndex] = useState(0);

  const currentConflict = conflicts[currentConflictIndex];
  const strategy = selectedStrategy[currentConflict?.id || ''] as any;

  const handleStrategyChange = (conflictId: string, value: string) => {
    setSelectedStrategy({ ...selectedStrategy, [conflictId]: value });
  };

  const handleApplyStrategy = async (conflictId: string, strategyValue: any) => {
    if (!strategyValue) return;

    try {
      await resolveConflict(conflictId, strategyValue);
      playSound(SoundEffect.SUCCESS);

      // 移动到下一个冲突
      if (currentConflictIndex < conflicts.length - 1) {
        setCurrentConflictIndex(prev => prev + 1);
      } else {
        // 所有冲突已解决
        onClose();
      }
    } catch (error) {
      playSound(SoundEffect.ERROR);
    }
  };

  const handleClose = () => {
    playSound(SoundEffect.BUTTON_CLICK);
    clearError();
    setCurrentConflictIndex(0);
    setSelectedStrategy({});
    onClose();
  };

  const getStrategyLabel = (strategy: string) => {
    switch (strategy) {
      case 'KeepBoth':
        return '保留两者';
      case 'KeepServer':
        return '保留服务器版本';
      case 'KeepLocal':
        return '保留本地版本';
      default:
        return strategy;
    }
  };

  const getStrategyDescription = (strategy: string) => {
    switch (strategy) {
      case 'KeepBoth':
        return '保留本地和服务器两个版本，创建副本';
      case 'KeepServer':
        return '使用服务器版本，覆盖本地更改';
      case 'KeepLocal':
        return '使用本地版本，覆盖服务器版本';
      default:
        return '';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-orange-500" />
            解决同步冲突
          </DialogTitle>
          <DialogDescription>
            {conflicts.length > 0 && (
              <>
                共有 {conflicts.length} 个冲突需要解决，当前处理第 {currentConflictIndex + 1} 个
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        {currentConflict ? (
          <div className="space-y-4">
            {/* 冲突信息 */}
            <div className="rounded-lg border p-4 bg-muted/20">
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle className="h-4 w-4 text-orange-500" />
                <span className="font-medium">{currentConflict.id}</span>
              </div>
              <p className="text-sm text-muted-foreground mb-3">
                {currentConflict.message}
              </p>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <HardDrive className="h-4 w-4 text-blue-500" />
                  <span className="text-muted-foreground">本地版本: v{currentConflict.localVersion}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Server className="h-4 w-4 text-green-500" />
                  <span className="text-muted-foreground">服务器版本: v{currentConflict.serverVersion}</span>
                </div>
              </div>
            </div>

            {/* 冲突解决策略 */}
            <div className="space-y-3">
              <Label>选择解决策略</Label>
              <RadioGroup
                value={strategy || ''}
                onValueChange={(value) => handleStrategyChange(currentConflict.id, value)}
              >
                <div className="space-y-3">
                  {(['KeepBoth', 'KeepLocal', 'KeepServer'] as const).map((s) => (
                    <div
                      key={s}
                      className={`
                        flex items-start space-x-3 rounded-lg border p-3 cursor-pointer transition-colors
                        ${strategy === s ? 'bg-primary/10 border-primary' : 'hover:bg-muted/30'}
                      `}
                    >
                      <RadioGroupItem value={s} id={`strategy-${s}`} className="mt-0.5" />
                      <div className="flex-1">
                        <Label
                          htmlFor={`strategy-${s}`}
                          className="font-medium cursor-pointer flex items-center gap-2"
                        >
                          {getStrategyLabel(s)}
                          {strategy === s && <CheckCircle className="h-4 w-4 text-primary" />}
                        </Label>
                        <p className="text-sm text-muted-foreground mt-1">
                          {getStrategyDescription(s)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </RadioGroup>
            </div>

            {/* 错误提示 */}
            {error && (
              <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">
                {error}
              </div>
            )}

            {/* 操作按钮 */}
            <div className="flex justify-between pt-2">
              <Button
                variant="outline"
                onClick={handleClose}
                disabled={isResolving}
              >
                取消
              </Button>
              <Button
                onClick={() => handleApplyStrategy(currentConflict.id, strategy)}
                disabled={!strategy || isResolving}
                className="min-w-[100px]"
              >
                {isResolving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    处理中
                  </>
                ) : (
                  '应用策略'
                )}
              </Button>
            </div>
          </div>
        ) : (
          <div className="py-8 text-center">
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-3" />
            <h3 className="text-lg font-medium mb-1">所有冲突已解决</h3>
            <p className="text-sm text-muted-foreground mb-4">
              您的同步已完成
            </p>
            <Button onClick={handleClose}>
              关闭
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

interface SingleConflictResolverProps {
  isOpen: boolean;
  onClose: () => void;
  conflict: ConflictInfo | null;
}

export function SingleConflictResolver({ isOpen, onClose, conflict }: SingleConflictResolverProps) {
  const { resolveConflict, isResolving, error, clearError } = useSyncStore();
  const [strategy, setStrategy] = useState<string>('');

  const handleClose = () => {
    playSound(SoundEffect.BUTTON_CLICK);
    clearError();
    setStrategy('');
    onClose();
  };

  const handleApply = async () => {
    if (!conflict || !strategy) return;

    try {
      await resolveConflict(conflict.id, strategy as any);
      playSound(SoundEffect.SUCCESS);
      handleClose();
    } catch (error) {
      playSound(SoundEffect.ERROR);
    }
  };

  const getStrategyLabel = (s: string) => {
    switch (s) {
      case 'KeepBoth': return '保留两者';
      case 'KeepServer': return '保留服务器版本';
      case 'KeepLocal': return '保留本地版本';
      default: return s;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-orange-500" />
            同步冲突
          </DialogTitle>
          <DialogDescription>
            需要解决一个同步冲突
          </DialogDescription>
        </DialogHeader>

        {conflict && (
          <div className="space-y-4">
            <div className="rounded-lg border p-4 bg-muted/20">
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle className="h-4 w-4 text-orange-500" />
                <span className="font-medium">{conflict.id}</span>
              </div>
              <p className="text-sm text-muted-foreground mb-2">{conflict.message}</p>
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span>本地: v{conflict.localVersion}</span>
                <span>服务器: v{conflict.serverVersion}</span>
              </div>
            </div>

            <div className="space-y-3">
              <Label>选择解决策略</Label>
              <RadioGroup value={strategy} onValueChange={setStrategy}>
                {(['KeepLocal', 'KeepServer', 'KeepBoth'] as const).map((s) => (
                  <div
                    key={s}
                    className={`
                      flex items-start space-x-3 rounded-lg border p-3
                      ${strategy === s ? 'bg-primary/10 border-primary' : 'hover:bg-muted/30'}
                    `}
                  >
                    <RadioGroupItem value={s} id={`s-${s}`} className="mt-0.5" />
                    <div>
                      <Label htmlFor={`s-${s}`} className="font-medium cursor-pointer">
                        {getStrategyLabel(s)}
                      </Label>
                      <p className="text-sm text-muted-foreground mt-1">
                        {s === 'KeepLocal' && '使用本地版本，覆盖服务器'}
                        {s === 'KeepServer' && '使用服务器版本，覆盖本地'}
                        {s === 'KeepBoth' && '保留两个版本，创建副本'}
                      </p>
                    </div>
                  </div>
                ))}
              </RadioGroup>
            </div>

            {error && (
              <div className="text-sm text-destructive bg-destructive/10 p-3">{error}</div>
            )}

            <div className="flex justify-between pt-2">
              <Button variant="outline" onClick={handleClose} disabled={isResolving}>
                取消
              </Button>
              <Button onClick={handleApply} disabled={!strategy || isResolving}>
                {isResolving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                应用
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
