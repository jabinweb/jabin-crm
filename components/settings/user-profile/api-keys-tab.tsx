'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Eye, EyeOff, Globe, Info, Key, Loader2, Sparkles } from 'lucide-react';
import { TabsContent } from '@/components/ui/tabs';
import { type useUserProfileSettings } from '@/hooks/use-user-profile-settings';
import { ProfileSaveButton } from './profile-save-button';

type UserProfileSettingsState = ReturnType<typeof useUserProfileSettings>;

interface ApiKeysTabProps extends Pick<
  UserProfileSettingsState,
  | 'formData'
  | 'handleChange'
  | 'updateProfileMutation'
  | 'showGeminiKey'
  | 'showGooglePlacesKey'
  | 'loadingGeminiKey'
  | 'loadingGooglePlacesKey'
  | 'availableModels'
  | 'modelsLoading'
  | 'toggleGeminiKeyVisibility'
  | 'toggleGooglePlacesKeyVisibility'
  | 'setGeminiKeyTouched'
  | 'setGooglePlacesKeyTouched'
  | 'refetchModels'
> {}

export function ApiKeysTab({
  formData,
  handleChange,
  updateProfileMutation,
  showGeminiKey,
  showGooglePlacesKey,
  loadingGeminiKey,
  loadingGooglePlacesKey,
  availableModels,
  modelsLoading,
  toggleGeminiKeyVisibility,
  toggleGooglePlacesKeyVisibility,
  setGeminiKeyTouched,
  setGooglePlacesKeyTouched,
  refetchModels,
}: ApiKeysTabProps) {
  return (
    <TabsContent value="api-keys" className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5 text-primary" />
            API Configuration
          </CardTitle>
          <CardDescription>
            Use your own API keys to avoid rate limits and quota issues
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              Your API keys are encrypted and stored securely. They&apos;re only used when you run scraping jobs.
            </AlertDescription>
          </Alert>

          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="geminiApiKey" className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4" />
                  Gemini API Key
                </Label>
                <span className="text-xs text-muted-foreground">Optional</span>
              </div>
              <div className="relative">
                <Input
                  id="geminiApiKey"
                  type={showGeminiKey ? 'text' : 'password'}
                  value={formData.geminiApiKey}
                  onFocus={(e) => {
                    if (e.target.value === '••••••••') {
                      setGeminiKeyTouched(true);
                      handleChange('geminiApiKey', '');
                    }
                  }}
                  onChange={(e) => {
                    setGeminiKeyTouched(true);
                    handleChange('geminiApiKey', e.target.value);
                  }}
                  placeholder="Enter your Gemini API key"
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={toggleGeminiKeyVisibility}
                  disabled={loadingGeminiKey}
                >
                  {loadingGeminiKey ? (
                    <Loader2 className="h-4 w-4 text-muted-foreground animate-spin" />
                  ) : showGeminiKey ? (
                    <EyeOff className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Eye className="h-4 w-4 text-muted-foreground" />
                  )}
                </Button>
              </div>
              <div className="flex items-start gap-2 text-xs text-muted-foreground">
                <Info className="h-3 w-3 mt-0.5 flex-shrink-0" />
                <div>
                  Get your free API key from{' '}
                  <a
                    href="https://ai.google.dev"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline font-medium"
                  >
                    Google AI Studio
                  </a>
                  . Used for AI-powered lead enrichment and data generation.
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => refetchModels()}
                disabled={modelsLoading || !formData.geminiApiKey}
                className="mt-2"
              >
                {modelsLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Checking...
                  </>
                ) : (
                  'Test API Key & Show Available Models'
                )}
              </Button>
              {availableModels?.models && (
                <Alert className="mt-2">
                  <Sparkles className="h-4 w-4" />
                  <AlertDescription>
                    <div className="font-medium mb-1">
                      ✓ API key valid! {availableModels.models.length} models available
                      {availableModels.usingUserKey && ' (using your key)'}
                    </div>
                    <div className="text-xs space-y-1">
                      {availableModels.models.slice(0, 5).map((model: { name: string }) => (
                        <div key={model.name} className="flex items-start gap-2">
                          <span className="font-mono text-primary">{model.name}</span>
                        </div>
                      ))}
                      {availableModels.models.length > 5 && (
                        <div className="text-muted-foreground">
                          ...and {availableModels.models.length - 5} more
                        </div>
                      )}
                    </div>
                  </AlertDescription>
                </Alert>
              )}
            </div>

            <Separator />

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="aiModel" className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4" />
                  AI Model
                </Label>
                {availableModels?.models?.length > 0 && (
                  <span className="text-xs text-muted-foreground">
                    {availableModels.models.length} available
                  </span>
                )}
              </div>
              <Select
                value={formData.aiModel}
                onValueChange={(value) => handleChange('aiModel', value)}
              >
                <SelectTrigger id="aiModel">
                  <SelectValue placeholder="Select AI model" />
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  {availableModels?.models?.length > 0 ? (
                    <>
                      {formData.aiModel && !availableModels.models.find((m: { name: string }) => m.name === formData.aiModel) && (
                        <SelectItem value={formData.aiModel}>
                          {formData.aiModel} (Current)
                        </SelectItem>
                      )}
                      {availableModels.models.map((model: { name: string; displayName: string }) => (
                        <SelectItem key={model.name} value={model.name}>
                          <div className="flex flex-col items-start">
                            <span className="font-medium">{model.displayName}</span>
                            {model.name !== model.displayName && (
                              <span className="text-xs text-muted-foreground">{model.name}</span>
                            )}
                          </div>
                        </SelectItem>
                      ))}
                    </>
                  ) : (
                    <>
                      {formData.aiModel && !['gemini-2.0-flash', 'gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-1.5-pro', 'gemini-1.5-flash'].includes(formData.aiModel) && (
                        <SelectItem value={formData.aiModel}>
                          {formData.aiModel} (Current)
                        </SelectItem>
                      )}
                      <SelectItem value="gemini-2.0-flash">
                        Gemini 2.0 Flash (Recommended)
                      </SelectItem>
                      <SelectItem value="gemini-2.5-flash">
                        Gemini 2.5 Flash
                      </SelectItem>
                      <SelectItem value="gemini-2.5-pro">
                        Gemini 2.5 Pro
                      </SelectItem>
                      <SelectItem value="gemini-1.5-pro">
                        Gemini 1.5 Pro
                      </SelectItem>
                      <SelectItem value="gemini-1.5-flash">
                        Gemini 1.5 Flash
                      </SelectItem>
                    </>
                  )}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {availableModels?.models?.length > 0
                  ? `Choose from ${availableModels.models.length} available models from your API key`
                  : 'Test your API key above to load available models, or select from defaults'
                }
              </p>
            </div>

            <Separator />

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="googlePlacesApiKey" className="flex items-center gap-2">
                  <Globe className="h-4 w-4" />
                  Google Places API Key
                </Label>
                <span className="text-xs text-muted-foreground">Optional</span>
              </div>
              <div className="relative">
                <Input
                  id="googlePlacesApiKey"
                  type={showGooglePlacesKey ? 'text' : 'password'}
                  value={formData.googlePlacesApiKey}
                  onFocus={(e) => {
                    if (e.target.value === '••••••••') {
                      setGooglePlacesKeyTouched(true);
                      handleChange('googlePlacesApiKey', '');
                    }
                  }}
                  onChange={(e) => {
                    setGooglePlacesKeyTouched(true);
                    handleChange('googlePlacesApiKey', e.target.value);
                  }}
                  placeholder="Enter your Google Places API key"
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={toggleGooglePlacesKeyVisibility}
                  disabled={loadingGooglePlacesKey}
                >
                  {loadingGooglePlacesKey ? (
                    <Loader2 className="h-4 w-4 text-muted-foreground animate-spin" />
                  ) : showGooglePlacesKey ? (
                    <EyeOff className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Eye className="h-4 w-4 text-muted-foreground" />
                  )}
                </Button>
              </div>
              <div className="flex items-start gap-2 text-xs text-muted-foreground">
                <Info className="h-3 w-3 mt-0.5 flex-shrink-0" />
                <div>
                  Get your API key from{' '}
                  <a
                    href="https://console.cloud.google.com/apis/credentials"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline font-medium"
                  >
                    Google Cloud Console
                  </a>
                  . Enable the Places API for your project. Used for verified business data and lead scraping.
                </div>
              </div>
            </div>
          </div>

          <ProfileSaveButton
            updateProfileMutation={updateProfileMutation}
            label="Save API Keys"
          />
        </CardContent>
      </Card>
    </TabsContent>
  );
}
