'use client'

import { Button } from "@/components/ui/button"
import { Loader2, SaveIcon } from "lucide-react"

interface SettingsLayoutProps {
  children: React.ReactNode
  onSave: () => Promise<void>
  /** Discard unsaved edits. Falls back to a page reload when not provided. */
  onCancel?: () => void
  isLoading?: boolean
  isDirty?: boolean
}

export function SettingsLayout({
  children,
  onSave,
  onCancel,
  isLoading,
  isDirty = false
}: SettingsLayoutProps) {
  return (
    <div className="relative min-w-0 space-y-6 pb-16">
      {children}

      {isDirty && (
        <div
          role="region"
          aria-label="Unsaved changes"
          className="fixed bottom-[calc(3.5rem+1px+env(safe-area-inset-bottom))] left-0 right-0 z-50 border-t bg-background/90 backdrop-blur-sm lg:bottom-0"
        >
          <div className="flex h-16 items-center justify-end gap-3 px-4 sm:px-6 lg:px-8">
            <p className="mr-auto hidden text-sm text-muted-foreground sm:block">
              You have unsaved changes
            </p>
            <Button
              onClick={() => (onCancel ? onCancel() : window.location.reload())}
              variant="ghost"
              disabled={isLoading}
            >
              Discard
            </Button>
            <Button
              onClick={onSave}
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving…
                </>
              ) : (
                <>
                  <SaveIcon className="mr-2 h-4 w-4" />
                  Save changes
                </>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
