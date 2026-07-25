'use client';

import type { ReactNode } from 'react';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/** Full-width bottom sheet — easy thumbs, works on phone and desktop. */
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
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent
        className={cn(
          'max-h-[92vh] outline-none',
          className
        )}
      >
        <DrawerHeader className="text-left px-4 pb-2">
          <DrawerTitle className="text-xl">{title}</DrawerTitle>
          {description ? (
            <DrawerDescription className="text-sm">{description}</DrawerDescription>
          ) : null}
        </DrawerHeader>
        <div className="overflow-y-auto px-4 pb-2 overscroll-contain">
          {children}
        </div>
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
        className
      )}
    >
      <Button
        size="lg"
        className="h-12 w-full text-base font-semibold shadow-md"
        onClick={onClick}
      >
        {label}
      </Button>
    </div>
  );
}
