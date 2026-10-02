'use client';

import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { FeatureModuleGuard } from '@/components/feature-module-guard';

/** Inventory pages need the Inventory module; registering installed equipment needs Equipment. */
export default function InventoryLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? '';
  const { data: session, status } = useSession();
  const registeringEquipment = /\/inventory\/new\/?$/.test(pathname);
  // Adjustments and transfers are stock writes (inventory:write — admins by default)
  const stockWritePage = /\/inventory\/(stock-adjustment|transfers)\/?$/.test(pathname);
  const canWriteStock = ['ADMIN', 'SUPER_ADMIN'].includes(session?.user?.role ?? '');
  return (
    <FeatureModuleGuard
      module={registeringEquipment ? 'EQUIPMENT' : 'INVENTORY'}
      title={registeringEquipment ? 'Equipment not available' : 'Inventory not available'}
    >
      {stockWritePage && status !== 'loading' && !canWriteStock ? (
        <div className="rounded-lg border bg-muted/30 p-6 text-sm text-muted-foreground">
          <p className="font-medium text-foreground">Admins only</p>
          <p className="mt-1">Ask a workspace admin to adjust or transfer stock.</p>
        </div>
      ) : (
        children
      )}
    </FeatureModuleGuard>
  );
}
