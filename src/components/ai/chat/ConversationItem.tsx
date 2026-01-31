/**
 * 对话项组件
 *
 * 显示单个对话历史记录
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AIConversationMeta } from '@/types/ai';
import { MessageSquare, Calendar, Trash2, Download, Archive } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { useAIStore } from '@/store/aiStore';
import { Button } from '@/components/ui/button';
import { AIHistoryManager } from '@/lib/ai/historyManager';
import { toast } from 'sonner';

interface ConversationItemProps {
  conversation: AIConversationMeta;
  onUpdate?: () => void;  // 添加回调函数
}

export function ConversationItem({ conversation, onUpdate }: ConversationItemProps) {
  const navigate = useNavigate();
  const { selectConversation, isServerOnline } = useAIStore();
  const [showActions, setShowActions] = useState(false);
  const [isOperating, setIsOperating] = useState(false);

  // 使用实时状态检查服务器是否在线
  const isOnline = isServerOnline(conversation.serverIdentity.sessionId);

  const handleClick = () => {
    selectConversation(conversation.id);
    navigate(`/ai-chat/${conversation.id}`);
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isOperating) return;

    toast('确定要删除这个对话吗？', {
      action: {
        label: '删除',
        onClick: async () => {
          setIsOperating(true);
          try {
            await AIHistoryManager.deleteConversation(conversation.id);
            toast.success('对话已删除');
            onUpdate?.();  // 调用回调刷新列表
          } catch (error) {
            console.error('删除失败:', error);
            toast.error('删除失败', {
              description: error instanceof Error ? error.message : String(error)
            });
          } finally {
            setIsOperating(false);
          }
        },
      },
    });
  };

  const handleExport = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isOperating) return;

    setIsOperating(true);
    try {
      console.log('开始导出对话:', conversation.id);
      const content = await AIHistoryManager.exportConversation(conversation.id, 'markdown');
      console.log('导出内容长度:', content?.length || 0);

      if (!content || content.length === 0) {
        throw new Error('导出内容为空');
      }

      // 简化文件名，移除特殊字符
      const safeTitle = conversation.title.replace(/[<>:"/\\|?*]/g, '_');
      const date = new Date().toISOString().split('T')[0];
      const filename = `${safeTitle}_${date}.md`;

      console.log('开始下载文件:', filename);
      await AIHistoryManager.downloadExport(content, filename, 'markdown');

      // 显示成功提示，告知用户文件位置
      toast.success('导出成功', {
        description: `文件已保存到下载文件夹: ${filename}`,
        duration: 5000,
      });
    } catch (error) {
      console.error('导出失败:', error);
      toast.error('导出失败', {
        description: error instanceof Error ? error.message : String(error)
      });
    } finally {
      setIsOperating(false);
    }
  };

  const handleArchive = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isOperating) return;

    setIsOperating(true);
    try {
      await AIHistoryManager.toggleArchive(conversation.id);
      toast.success('归档状态已更新');
      onUpdate?.();  // 调用回调刷新列表
    } catch (error) {
      console.error('操作失败:', error);
      toast.error('操作失败', {
        description: error instanceof Error ? error.message : String(error)
      });
    } finally {
      setIsOperating(false);
    }
  };

  const formatDate = () => {
    try {
      return formatDistanceToNow(new Date(conversation.updatedAt), {
        addSuffix: true,
        locale: zhCN,
      });
    } catch {
      return conversation.updatedAt;
    }
  };

  return (
    <div
      className="group relative w-full text-left px-4 py-3 hover:bg-muted/50 transition-colors border-b last:border-b-0"
      onClick={handleClick}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      <div className="flex items-start gap-3">
        <div className="w-6 h-6 rounded bg-primary/5 flex items-center justify-center flex-shrink-0 mt-0.5">
          <MessageSquare className="w-3 h-3 text-primary/60" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-sm font-medium truncate flex-1">
              {conversation.title}
              {conversation.isArchived && (
                <span className="ml-2 text-xs text-muted-foreground">(已归档)</span>
              )}
            </h4>
            {isOnline && (
              <span className="flex-shrink-0 w-2 h-2 rounded-full bg-green-500" />
            )}
          </div>

          <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
            <Calendar className="w-3 h-3" />
            <span>{formatDate()}</span>
            <span>•</span>
            <span>{conversation.messageCount} 条消息</span>
          </div>
        </div>

        {/* 操作按钮 */}
        <div
          className={`flex items-center gap-1 transition-opacity ${
            showActions ? 'opacity-100' : 'opacity-0'
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={handleExport}
            title="导出"
            disabled={isOperating}
          >
            <Download className="w-3 h-3" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={handleArchive}
            title={conversation.isArchived ? '取消归档' : '归档'}
            disabled={isOperating}
          >
            <Archive className="w-3 h-3" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 text-destructive hover:text-destructive"
            onClick={handleDelete}
            title="删除"
            disabled={isOperating}
          >
            <Trash2 className="w-3 h-3" />
          </Button>
        </div>
      </div>
    </div>
  );
}
