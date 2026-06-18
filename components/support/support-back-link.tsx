import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useWorkspacePaths } from '@/hooks/use-workspace-paths';

export function SupportBackLink() {
  const { path } = useWorkspacePaths();

  return (
    <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2">
      <Link href={path('/dashboard/support')}>
        <ChevronLeft className="h-4 w-4 mr-2" />
        Support desk
      </Link>
    </Button>
  );
}
