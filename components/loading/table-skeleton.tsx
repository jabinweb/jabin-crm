import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { PageHeaderSkeleton } from './primitives';

export type TableSkeletonProps = {
  columnCount?: number;
  rowCount?: number;
  className?: string;
};

export function TableSkeleton({
  columnCount = 5,
  rowCount = 5,
  className,
}: TableSkeletonProps) {
  return (
    <Table className={className}>
      <TableHeader>
        <TableRow>
          {Array.from({ length: columnCount }).map((_, index) => (
            <TableHead key={index}>
              <Skeleton className="h-4 w-24" />
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {Array.from({ length: rowCount }).map((_, rowIndex) => (
          <TableRow key={rowIndex}>
            {Array.from({ length: columnCount }).map((_, colIndex) => (
              <TableCell key={colIndex}>
                <Skeleton className="h-4 w-full" />
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export function FullTableSkeleton({
  columnCount = 5,
  rowCount = 5,
  className,
}: TableSkeletonProps) {
  return (
    <div className={cn('rounded-md border', className)}>
      <div className="relative w-full overflow-auto">
        <TableSkeleton columnCount={columnCount} rowCount={rowCount} />
      </div>
    </div>
  );
}

export function LeadsTableSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('space-y-4', className)}>
      <PageHeaderSkeleton />
      <FullTableSkeleton columnCount={7} rowCount={5} />
    </div>
  );
}
