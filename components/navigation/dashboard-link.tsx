'use client';

import Link from 'next/link';
import type { ComponentProps } from 'react';
import { useWorkspacePaths } from '@/hooks/use-workspace-paths';

type Props = Omit<ComponentProps<typeof Link>, 'href'> & {
  href: string;
};

/** Link that resolves `/dashboard/...` paths to `/{company}/dashboard/...` when scoped. */
export function DashboardLink({ href, ...props }: Props) {
  const { path } = useWorkspacePaths();
  return <Link href={path(href)} {...props} />;
}
