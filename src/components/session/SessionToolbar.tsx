import { useTranslation } from 'react-i18next';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Filter } from 'lucide-react';
import { memo } from 'react';

interface SessionToolbarProps {
  search: string;
  onSearchChange: (value: string) => void;
  filter: string;
  onFilterChange: (value: string) => void;
}

export const SessionToolbar = memo(function SessionToolbar({
  search,
  onSearchChange,
  filter,
  onFilterChange,
}: SessionToolbarProps) {
  const { t } = useTranslation();

  return (
    <div className="flex items-center gap-4">
      <div className="relative flex-1 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={t('session.search.placeholder')}
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9"
        />
      </div>

      <div className="flex items-center gap-2">
        <Filter className="h-4 w-4 text-muted-foreground" />
        <Button
          size="sm"
          variant={filter === 'all' ? 'default' : 'outline'}
          onClick={() => onFilterChange('all')}
        >
          {t('session.filter.all')}
        </Button>
        <Button
          size="sm"
          variant={filter === 'connected' ? 'default' : 'outline'}
          onClick={() => onFilterChange('connected')}
        >
          {t('session.filter.connected')}
        </Button>
        <Button
          size="sm"
          variant={filter === 'disconnected' ? 'default' : 'outline'}
          onClick={() => onFilterChange('disconnected')}
        >
          {t('session.filter.disconnected')}
        </Button>
      </div>
    </div>
  );
});
