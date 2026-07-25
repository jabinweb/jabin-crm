'use client';

import { useEffect, useState, type ReactNode } from 'react';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

function useIsDesktop(breakpointPx = 768) {
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(`(min-width: ${breakpointPx}px)`);
    const apply = () => setIsDesktop(mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [breakpointPx]);

  return isDesktop;
}

/** Bottom sheet on mobile; centered dialog on desktop. */
export function EasyBottomSheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  className,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}) {
  const isDesktop = useIsDesktop();

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className={cn(
            'flex max-h-[85vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-lg',
            className
          )}
        >
          <DialogHeader className="space-y-1 px-6 pt-6 pb-3 text-left">
            <DialogTitle className="text-xl">{title}</DialogTitle>
            {description ? (
              <DialogDescription className="text-sm">{description}</DialogDescription>
            ) : null}
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 pb-2">
            {children}
          </div>
          {footer ? (
            <DialogFooter className="border-t bg-background px-6 py-4 sm:justify-stretch">
              {footer}
            </DialogFooter>
          ) : null}
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className={cn('max-h-[92vh] outline-none', className)}>
        <DrawerHeader className="px-4 pb-2 text-left">
          <DrawerTitle className="text-xl">{title}</DrawerTitle>
          {description ? (
            <DrawerDescription className="text-sm">{description}</DrawerDescription>
          ) : null}
        </DrawerHeader>
        <div className="overflow-y-auto overscroll-contain px-4 pb-2">{children}</div>
        {footer ? (
          <DrawerFooter className="border-t bg-background px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
            {footer}
          </DrawerFooter>
        ) : null}
      </DrawerContent>
    </Drawer>
  );
}

export function EasyFab({
  label,
  onClick,
  className,
}: {
  label: string;
  onClick: () => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'sticky bottom-0 z-20 -mx-1 mt-4 bg-gradient-to-t from-background via-background to-transparent pt-6 pb-[max(0.75rem,env(safe-area-inset-bottom))]',
        'md:static md:mx-0 md:bg-none md:pt-4 md:pb-0',
        className
      )}
    >
      <Button
        size="lg"
        className="h-12 w-full text-base font-semibold shadow-md md:w-auto md:min-w-[12rem]"
        onClick={onClick}
      >
        {label}
      </Button>
    </div>
  );
}
