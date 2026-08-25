'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';

type Crumb = {
  label: string;
  href?: string;
};

type DetailChromeProps = {
  /** Breadcrumb trail; last item is the current page (no href). */
  crumbs: Crumb[];
  /** Primary back target (list page). */
  backHref: string;
  backLabel?: string;
  children?: React.ReactNode;
};

/** Consistent detail header: breadcrumbs + back to list (not browser history). */
export function DetailChrome({
  crumbs,
  backHref,
  backLabel = 'Back',
  children,
}: DetailChromeProps) {
  const last = crumbs[crumbs.length - 1];
  const parents = crumbs.slice(0, -1);

  return (
    <div className="flex flex-col gap-3">
      <Breadcrumb>
        <BreadcrumbList>
          {parents.map((c, i) => (
            <span key={`${c.label}-${i}`} className="contents">
              {i > 0 ? <BreadcrumbSeparator /> : null}
              <BreadcrumbItem>
                {c.href ? (
                  <BreadcrumbLink asChild>
                    <Link href={c.href}>{c.label}</Link>
                  </BreadcrumbLink>
                ) : (
                  <BreadcrumbPage>{c.label}</BreadcrumbPage>
                )}
              </BreadcrumbItem>
            </span>
          ))}
          {last ? (
            <>
              {parents.length > 0 ? <BreadcrumbSeparator /> : null}
              <BreadcrumbItem>
                <BreadcrumbPage className="max-w-[240px] truncate">
                  {last.label}
                </BreadcrumbPage>
              </BreadcrumbItem>
            </>
          ) : null}
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button variant="ghost" size="sm" asChild className="-ml-2 text-muted-foreground">
          <Link href={backHref}>
            <ArrowLeft className="mr-1.5 size-4" />
            {backLabel}
          </Link>
        </Button>
        {children}
      </div>
    </div>
  );
}
