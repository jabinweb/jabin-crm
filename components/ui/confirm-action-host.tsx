'use client';

import { useEffect, useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  resolveConfirmAction,
  subscribeConfirmAction,
} from '@/lib/confirm-action';
import { cn } from '@/lib/utils';

type Pending = {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'default' | 'destructive';
};

/** Mount once near Toaster — powers `confirmAction()` everywhere. */
export function ConfirmActionHost() {
  const [pending, setPending] = useState<Pending | null>(null);

  useEffect(() => subscribeConfirmAction(setPending), []);

  return (
    <AlertDialog
      open={!!pending}
      onOpenChange={(open) => {
        if (!open) resolveConfirmAction(false);
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{pending?.title ?? 'Are you sure?'}</AlertDialogTitle>
          {pending?.description ? (
            <AlertDialogDescription>{pending.description}</AlertDialogDescription>
          ) : null}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{pending?.cancelLabel ?? 'Cancel'}</AlertDialogCancel>
          <AlertDialogAction
            className={cn(
              pending?.variant === 'destructive' &&
                'bg-destructive text-destructive-foreground hover:bg-destructive/90'
            )}
            onClick={(e) => {
              e.preventDefault();
              resolveConfirmAction(true);
            }}
          >
            {pending?.confirmLabel ?? 'Continue'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
