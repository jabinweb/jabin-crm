'use client';

import { Button } from '@/components/ui/button';
import { Loader2, Save } from 'lucide-react';
import { type useUserProfileSettings } from '@/hooks/use-user-profile-settings';

type UserProfileSettingsState = ReturnType<typeof useUserProfileSettings>;

interface ProfileSaveButtonProps extends Pick<UserProfileSettingsState, 'updateProfileMutation'> {
  label?: string;
}

export function ProfileSaveButton({
  updateProfileMutation,
  label = 'Save Changes',
}: ProfileSaveButtonProps) {
  return (
    <div className="flex justify-end">
      <Button type="submit" disabled={updateProfileMutation.isPending}>
        {updateProfileMutation.isPending ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Saving...
          </>
        ) : (
          <>
            <Save className="mr-2 h-4 w-4" />
            {label}
          </>
        )}
      </Button>
    </div>
  );
}
