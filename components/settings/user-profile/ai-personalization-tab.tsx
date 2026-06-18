'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Info, Sparkles } from 'lucide-react';
import { TabsContent } from '@/components/ui/tabs';
import { type useUserProfileSettings } from '@/hooks/use-user-profile-settings';
import { ProfileSaveButton } from './profile-save-button';

type UserProfileSettingsState = ReturnType<typeof useUserProfileSettings>;

interface AiPersonalizationTabProps extends Pick<
  UserProfileSettingsState,
  'formData' | 'handleChange' | 'updateProfileMutation'
> {}

export function AiPersonalizationTab({ formData, handleChange, updateProfileMutation }: AiPersonalizationTabProps) {
  return (
    <TabsContent value="ai-personalization" className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            AI Personalization
          </CardTitle>
          <CardDescription>
            This information powers AI-generated cold emails
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              The more detailed and specific you are, the better your AI-generated emails will perform.
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <Label htmlFor="service">Your Service/Product *</Label>
            <Textarea
              id="service"
              value={formData.service}
              onChange={(e) => handleChange('service', e.target.value)}
              placeholder="What service or product do you offer?"
              rows={3}
              required
            />
            <p className="text-xs text-muted-foreground">
              Be specific - this will be used in email personalization
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="targetAudience">Target Audience</Label>
            <Input
              id="targetAudience"
              value={formData.targetAudience}
              onChange={(e) => handleChange('targetAudience', e.target.value)}
              placeholder="e.g., Small business owners, CMOs, Healthcare providers"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="valueProposition">Value Proposition *</Label>
            <Textarea
              id="valueProposition"
              value={formData.valueProposition}
              onChange={(e) => handleChange('valueProposition', e.target.value)}
              placeholder="What makes your offer unique? How do you help customers?"
              rows={4}
              required
            />
            <p className="text-xs text-muted-foreground">
              This will be used to craft compelling cold emails
            </p>
          </div>

          <ProfileSaveButton updateProfileMutation={updateProfileMutation} />
        </CardContent>
      </Card>
    </TabsContent>
  );
}
