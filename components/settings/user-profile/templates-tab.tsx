'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Info } from 'lucide-react';
import { TabsContent } from '@/components/ui/tabs';
import { type useUserProfileSettings } from '@/hooks/use-user-profile-settings';
import { ProfileSaveButton } from './profile-save-button';

type UserProfileSettingsState = ReturnType<typeof useUserProfileSettings>;

interface TemplatesTabProps extends Pick<
  UserProfileSettingsState,
  'formData' | 'handleChange' | 'updateProfileMutation'
> {}

export function TemplatesTab({ formData, handleChange, updateProfileMutation }: TemplatesTabProps) {
  return (
    <TabsContent value="templates" className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
            </svg>
            Template Customization
          </CardTitle>
          <CardDescription>
            Customize the appearance of your invoices and quotations
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="templateStyle">Template Style</Label>
            <Select
              value={formData.templateStyle}
              onValueChange={(value) => handleChange('templateStyle', value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="modern">Modern - Clean and contemporary</SelectItem>
                <SelectItem value="classic">Classic - Traditional business style</SelectItem>
                <SelectItem value="minimal">Minimal - Simple and elegant</SelectItem>
                <SelectItem value="corporate">Corporate - Professional and formal</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Choose the overall design style for your documents
            </p>
          </div>

          <Separator />

          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="primaryColor">Primary Color</Label>
              <div className="flex gap-2">
                <Input
                  id="primaryColor"
                  type="color"
                  value={formData.primaryColor}
                  onChange={(e) => handleChange('primaryColor', e.target.value)}
                  className="w-20 h-10"
                />
                <Input
                  value={formData.primaryColor}
                  onChange={(e) => handleChange('primaryColor', e.target.value)}
                  placeholder="#2563eb"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Used for headers and accents
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="secondaryColor">Secondary Color</Label>
              <div className="flex gap-2">
                <Input
                  id="secondaryColor"
                  type="color"
                  value={formData.secondaryColor}
                  onChange={(e) => handleChange('secondaryColor', e.target.value)}
                  className="w-20 h-10"
                />
                <Input
                  value={formData.secondaryColor}
                  onChange={(e) => handleChange('secondaryColor', e.target.value)}
                  placeholder="#7c3aed"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Used for quotation highlights
              </p>
            </div>
          </div>

          <Separator />

          <div className="space-y-2">
            <Label htmlFor="logoUrl">Logo URL</Label>
            <Input
              id="logoUrl"
              value={formData.logoUrl}
              onChange={(e) => handleChange('logoUrl', e.target.value)}
              placeholder="https://yourdomain.com/logo.png"
            />
            <p className="text-xs text-muted-foreground">
              Upload your logo online and paste the URL here. Recommended size: 200x80px
            </p>
          </div>

          <Separator />

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="headerText">Custom Header Text</Label>
              <Textarea
                id="headerText"
                value={formData.headerText}
                onChange={(e) => handleChange('headerText', e.target.value)}
                placeholder="Optional custom text to appear in the header of documents"
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="footerText">Custom Footer Text</Label>
              <Textarea
                id="footerText"
                value={formData.footerText}
                onChange={(e) => handleChange('footerText', e.target.value)}
                placeholder="Thank you for your business! We look forward to working with you."
                rows={2}
              />
              <p className="text-xs text-muted-foreground">
                This will replace the default footer text on invoices and quotations
              </p>
            </div>
          </div>

          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              Template changes will apply to all new invoices and quotations. Existing documents won&apos;t be affected.
            </AlertDescription>
          </Alert>

          <ProfileSaveButton
            updateProfileMutation={updateProfileMutation}
            label="Save Template Settings"
          />
        </CardContent>
      </Card>
    </TabsContent>
  );
}
