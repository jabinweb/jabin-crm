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
import { Input } from '@/components/ui/input';
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
  confirmText?: string;
  confirmTextLabel?: string;
};

/** Mount once near Toaster — powers `confirmAction()` everywhere. */
export function ConfirmActionHost() {
  const [pending, setPending] = useState<Pending | null>(null);
  const [typed, setTyped] = useState('');

  useEffect(() => subscribeConfirmAction(setPending), []);

  useEffect(() => {
    setTyped('');
  }, [pending]);

  const requiresMatch = Boolean(pending?.confirmText);
  const matchOk =
    !requiresMatch ||
    typed.trim() === (pending?.confirmText ?? '').trim();

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
        {requiresMatch ? (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              {pending?.confirmTextLabel ??
                `Type "${pending?.confirmText}" to confirm`}
            </p>
            <Input
              autoFocus
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder={pending?.confirmText}
              autoComplete="off"
              spellCheck={false}
            />
          </div>
        ) : null}
        <AlertDialogFooter>
          <AlertDialogCancel>{pending?.cancelLabel ?? 'Cancel'}</AlertDialogCancel>
          <AlertDialogAction
            disabled={!matchOk}
            className={cn(
              pending?.variant === 'destructive' &&
                'bg-destructive text-destructive-foreground hover:bg-destructive/90',
              !matchOk && 'pointer-events-none opacity-50'
            )}
            onClick={(e) => {
              e.preventDefault();
              if (!matchOk) return;
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
