'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Clock } from 'lucide-react';
import { getRecentEntities, type RecentEntity } from '@/lib/crm/recent-entities';
import { cn } from '@/lib/utils';

export function RecentEntitiesList({
  className,
  compact,
}: {
  className?: string;
  compact?: boolean;
}) {
  const [items, setItems] = useState<RecentEntity[]>([]);

  useEffect(() => {
    const refresh = () => setItems(getRecentEntities());
    refresh();
    window.addEventListener('crm:recent-updated', refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener('crm:recent-updated', refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);

  if (!items.length) return null;

  return (
    <div className={cn('space-y-1', className)}>
      <p className="px-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1">
        <Clock className="h-3 w-3" />
        Recent
      </p>
      {items.map((item) => (
        <Link
          key={`${item.type}-${item.id}`}
          href={item.href}
          className={cn(
            'block rounded-md px-2 py-1.5 text-sm hover:bg-muted truncate',
            compact && 'text-xs py-1'
          )}
        >
          <span className="text-muted-foreground capitalize">{item.type}</span>
          {' · '}
          {item.label}
        </Link>
      ))}
    </div>
  );
}
