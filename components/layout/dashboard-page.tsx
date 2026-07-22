/**
 * Shared page shell for tenant dashboard pages.
 * Layout already provides max-width + padding — pages should only set vertical rhythm.
 */
export function DashboardPage({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={className ?? 'space-y-6'}>{children}</div>;
}
