'use client';

import { useMemo, useState } from 'react';
import { Check, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { UserAvatar } from '@/components/ui/user-avatar';
import { cn } from '@/lib/utils';
import { displayName, type Person } from './use-messaging';

/** Searchable list of teammates; single or multi select. */
export function PeoplePicker({
  people,
  selected,
  onToggle,
  exclude = [],
  multiple = true,
  emptyText = 'No one else in this workspace yet.',
}: {
  people: Person[];
  selected: string[];
  onToggle: (id: string) => void;
  exclude?: string[];
  multiple?: boolean;
  emptyText?: string;
}) {
  const [query, setQuery] = useState('');
  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return people
      .filter((p) => !exclude.includes(p.id))
      .filter((p) => !q || p.name?.toLowerCase().includes(q) || p.email.toLowerCase().includes(q));
  }, [exclude, people, query]);

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name or email"
          className="h-9 pl-8"
        />
      </div>
      <div className="max-h-72 overflow-y-auto rounded-md border" role="listbox" aria-multiselectable={multiple}>
        {list.length === 0 ? (
          <p className="px-3 py-6 text-center text-sm text-muted-foreground">
            {people.length - exclude.length <= 0 ? emptyText : 'No one matches.'}
          </p>
        ) : (
          list.map((person) => {
            const isSelected = selected.includes(person.id);
            return (
              <button
                key={person.id}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => onToggle(person.id)}
                className={cn(
                  'flex w-full items-center gap-3 border-b px-3 py-2 text-left last:border-b-0 hover:bg-muted/50',
                  isSelected && 'bg-primary/5'
                )}
              >
                <UserAvatar person={person} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{displayName(person)}</span>
                  <span className="block truncate text-xs text-muted-foreground">{person.email}</span>
                </span>
                {multiple ? (
                  <span
                    className={cn(
                      'flex h-4 w-4 shrink-0 items-center justify-center rounded border',
                      isSelected ? 'border-primary bg-primary text-primary-foreground' : 'border-input'
                    )}
                  >
                    {isSelected ? <Check className="h-3 w-3" /> : null}
                  </span>
                ) : null}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
