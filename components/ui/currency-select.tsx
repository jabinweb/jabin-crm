'use client';

import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CURRENCY_OPTIONS, type CurrencyCode } from '@/lib/currency';

type CurrencySelectProps = {
  value: string;
  onValueChange: (value: CurrencyCode | string) => void;
  label?: string;
  id?: string;
  allowEmpty?: boolean;
  emptyLabel?: string;
  description?: string;
  className?: string;
};

export function CurrencySelect({
  value,
  onValueChange,
  label = 'Currency',
  id = 'currency',
  allowEmpty = false,
  emptyLabel = 'Use company default',
  description,
  className,
}: CurrencySelectProps) {
  return (
    <div className={className ? `space-y-2 ${className}` : 'space-y-2'}>
      {label ? <Label htmlFor={id}>{label}</Label> : null}
      <Select
        value={value || (allowEmpty ? '__default__' : '')}
        onValueChange={(v) => onValueChange(v === '__default__' ? '' : v)}
      >
        <SelectTrigger id={id}>
          <SelectValue placeholder="Select currency" />
        </SelectTrigger>
        <SelectContent>
          {allowEmpty ? <SelectItem value="__default__">{emptyLabel}</SelectItem> : null}
          {CURRENCY_OPTIONS.map((opt) => (
            <SelectItem key={opt.code} value={opt.code}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
    </div>
  );
}
