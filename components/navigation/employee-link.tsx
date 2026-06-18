'use client';

import Link from 'next/link';
import type { ComponentProps } from 'react';
import { useWorkspacePaths } from '@/hooks/use-workspace-paths';

type Props = Omit<ComponentProps<typeof Link>, 'href'> & {
  href: string;
};

/** Link that resolves `/employee/...` paths to `/{company}/employee/...` when scoped. */
export function EmployeeLink({ href, ...props }: Props) {
  const { employeePath } = useWorkspacePaths();
  return <Link href={employeePath(href)} {...props} />;
}
