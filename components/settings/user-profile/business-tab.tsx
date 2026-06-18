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
import { Building, Globe, Info } from 'lucide-react';
import { TabsContent } from '@/components/ui/tabs';
import { type useUserProfileSettings } from '@/hooks/use-user-profile-settings';
import { ProfileSaveButton } from './profile-save-button';

type UserProfileSettingsState = ReturnType<typeof useUserProfileSettings>;

interface BusinessTabProps extends Pick<
  UserProfileSettingsState,
  'formData' | 'handleChange' | 'updateProfileMutation'
> {}

export function BusinessTab({ formData, handleChange, updateProfileMutation }: BusinessTabProps) {
  return (
    <TabsContent value="profile" className="space-y-6">
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] text-foreground flex items-center gap-3">
            <Building className="h-4 w-4" />
            Personnel / Entity Data
          </CardTitle>
          <CardDescription className="text-[9px] uppercase tracking-widest font-bold opacity-50">
            Base operational parameters
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="companyName" className="text-[9px] uppercase font-bold tracking-widest opacity-70">Legal Entity Name *</Label>
              <Input
                id="companyName"
                value={formData.companyName}
                onChange={(e) => handleChange('companyName', e.target.value)}
                placeholder="Your company name"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="industry" className="text-[9px] uppercase font-bold tracking-widest opacity-70">Sector Classification *</Label>
              <Select value={formData.industry} onValueChange={(value) => handleChange('industry', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select industry" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Technology">Technology</SelectItem>
                  <SelectItem value="Healthcare">Healthcare</SelectItem>
                  <SelectItem value="Finance">Finance</SelectItem>
                  <SelectItem value="Education">Education</SelectItem>
                  <SelectItem value="Manufacturing">Manufacturing</SelectItem>
                  <SelectItem value="Retail">Retail</SelectItem>
                  <SelectItem value="Real Estate">Real Estate</SelectItem>
                  <SelectItem value="Marketing">Marketing</SelectItem>
                  <SelectItem value="Consulting">Consulting</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="companySize">Company Size</Label>
              <Select value={formData.companySize} onValueChange={(value) => handleChange('companySize', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select company size" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1-10">1-10 employees</SelectItem>
                  <SelectItem value="11-50">11-50 employees</SelectItem>
                  <SelectItem value="51-200">51-200 employees</SelectItem>
                  <SelectItem value="201-500">201-500 employees</SelectItem>
                  <SelectItem value="500+">500+ employees</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="website" className="text-[9px] uppercase font-bold tracking-widest opacity-70">Web Gateway</Label>
              <div className="relative">
                <Globe className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="website"
                  type="url"
                  value={formData.website}
                  onChange={(e) => handleChange('website', e.target.value)}
                  placeholder="https://yourcompany.com"
                  className="pl-10"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="preferredCurrency">Preferred Currency</Label>
              <Select
                key={`currency-${formData.preferredCurrency}`}
                value={formData.preferredCurrency}
                onValueChange={(value) => handleChange('preferredCurrency', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select currency" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="USD">USD - US Dollar ($)</SelectItem>
                  <SelectItem value="EUR">EUR - Euro (€)</SelectItem>
                  <SelectItem value="GBP">GBP - British Pound (£)</SelectItem>
                  <SelectItem value="INR">INR - Indian Rupee (₹)</SelectItem>
                  <SelectItem value="AUD">AUD - Australian Dollar (A$)</SelectItem>
                  <SelectItem value="CAD">CAD - Canadian Dollar (C$)</SelectItem>
                  <SelectItem value="JPY">JPY - Japanese Yen (¥)</SelectItem>
                  <SelectItem value="CNY">CNY - Chinese Yuan (¥)</SelectItem>
                  <SelectItem value="CHF">CHF - Swiss Franc (Fr)</SelectItem>
                  <SelectItem value="SGD">SGD - Singapore Dollar (S$)</SelectItem>
                  <SelectItem value="AED">AED - UAE Dirham (د.إ)</SelectItem>
                  <SelectItem value="BRL">BRL - Brazilian Real (R$)</SelectItem>
                  <SelectItem value="MXN">MXN - Mexican Peso ($)</SelectItem>
                  <SelectItem value="ZAR">ZAR - South African Rand (R)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Current: {formData.preferredCurrency}</p>
            </div>
          </div>
          <Separator />

          <div className="space-y-2">
            <Label htmlFor="description">Company Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => handleChange('description', e.target.value)}
              placeholder="Brief description of your company"
              rows={3}
            />
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Info className="h-3 w-3" />
              Help AI understand what your company does
            </p>
          </div>

          <ProfileSaveButton updateProfileMutation={updateProfileMutation} />
        </CardContent>
      </Card>
    </TabsContent>
  );
}
