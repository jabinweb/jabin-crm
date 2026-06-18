'use client';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Building, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useWorkspacePaths } from '@/hooks/use-workspace-paths';
import { useState } from 'react';

interface ProfileCompletionBannerProps {
  isComplete: boolean;
}

export function ProfileCompletionBanner({ isComplete }: ProfileCompletionBannerProps) {
  const router = useRouter();
  const { path } = useWorkspacePaths();
  const [isDismissed, setIsDismissed] = useState(false);

  if (isComplete || isDismissed) {
    return null;
  }

  return (
    <Alert className="mb-6 border-foreground/10 bg-muted/30">
      <AlertTitle className="text-foreground font-bold uppercase tracking-wider text-[10px]">
        Action Required: Business Profile
      </AlertTitle>
      <AlertDescription className="text-foreground mt-2">
        <div className="flex items-center justify-between">
          <p className="text-sm">
            Add your business information to generate better personalized cold emails with AI. 
            It only takes 2 minutes!
          </p>
          <div className="flex items-center space-x-2 ml-4">
            <Button 
              size="sm" 
              onClick={() => router.push(path('/dashboard/settings'))}
              className="text-[10px] font-bold uppercase tracking-tighter h-8"
            >
              Complete Now
            </Button>
            <Button 
              size="sm" 
              variant="ghost"
              onClick={() => setIsDismissed(true)}
              className="h-8 w-8 p-0"
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </AlertDescription>
    </Alert>
  );
}
