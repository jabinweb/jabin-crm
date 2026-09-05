'use client';

import { cn } from '@/lib/utils';
import { getClientBrandConfig } from '@/lib/branding';

const DEFAULT_MARK = '/brand/opslane-mark.svg';

type OpslaneLogoProps = {
  className?: string;
  markClassName?: string;
  withWordmark?: boolean;
  wordmarkClassName?: string;
  size?: number;
  priority?: boolean;
};

export function OpslaneLogo({
  className,
  markClassName,
  withWordmark = false,
  wordmarkClassName,
  size = 28,
}: OpslaneLogoProps) {
  const brand = getClientBrandConfig();
  const src = brand.logoUrl || DEFAULT_MARK;

  return (
    <span className={cn('inline-flex items-center gap-2 min-w-0', className)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={brand.appName}
        width={size}
        height={size}
        className={cn('shrink-0 rounded-[22%]', markClassName)}
        decoding="async"
      />
      {withWordmark ? (
        <span
          className={cn(
            'truncate text-sm font-semibold tracking-tight text-foreground',
            wordmarkClassName
          )}
        >
          {brand.appName}
        </span>
      ) : null}
    </span>
  );
}
