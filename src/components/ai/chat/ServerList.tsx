/**
 * 服务器列表组件
 *
 * 显示按服务器分组的历史对话列表
 */

import { useTranslation } from 'react-i18next';
import { ServerConversationGroup } from '@/types/ai';
import { ServerGroupItem } from './ServerGroupItem';
import { Server } from 'lucide-react';

interface ServerListProps {
  groups: ServerConversationGroup[];
}

export function ServerList({ groups }: ServerListProps) {
  const { t } = useTranslation();

  if (groups.length === 0) {
    return (
      <div className="flex items-center justify-center h-full min-h-[200px] text-center">
        <div className="px-4">
          <Server className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p className="text-muted-foreground text-sm">{t('ai.chat.noHistory')}</p>
          <p className="text-xs mt-1 text-muted-foreground">{t('ai.chat.clickToCreateNew')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-2 space-y-2 min-h-full">
      {groups.map((group) => (
        <ServerGroupItem
          key={group.serverIdentity.sessionId}
          group={group}
        />
      ))}
    </div>
  );
}
