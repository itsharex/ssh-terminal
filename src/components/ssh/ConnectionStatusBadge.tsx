import { Badge } from '@/components/ui/badge';
import { SessionStatus } from '@/types/ssh';
import { cn } from '@/lib/utils';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';

interface ConnectionStatusBadgeProps {
  status: SessionStatus;
  className?: string;
}

export const ConnectionStatusBadge = memo(function ConnectionStatusBadge({ status, className }: ConnectionStatusBadgeProps) {
  const { t } = useTranslation();

  const statusConfig = {
    connected: { label: t('session.status.connected'), className: 'badge-connected' },
    connecting: { label: t('session.status.connecting'), className: 'badge-connecting' },
    disconnected: { label: t('session.status.disconnected'), className: 'badge-disconnected' },
    error: { label: t('session.status.error'), className: 'badge-error' },
  };

  const config = statusConfig[status] || statusConfig.disconnected;

  return (
    <Badge variant="outline" className={cn(config.className, className)}>
      {config.label}
    </Badge>
  );
});
