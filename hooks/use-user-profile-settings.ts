'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  DEFAULT_USER_PROFILE_FORM,
  type UserProfileFormData,
} from '@/types/user-profile';

export function useUserProfileSettings() {
  const queryClient = useQueryClient();
  const [showGeminiKey, setShowGeminiKey] = useState(false);
  const [showGooglePlacesKey, setShowGooglePlacesKey] = useState(false);
  const [geminiKeyTouched, setGeminiKeyTouched] = useState(false);
  const [googlePlacesKeyTouched, setGooglePlacesKeyTouched] = useState(false);
  const [loadingGeminiKey, setLoadingGeminiKey] = useState(false);
  const [loadingGooglePlacesKey, setLoadingGooglePlacesKey] = useState(false);
  const [formData, setFormData] = useState<UserProfileFormData>(DEFAULT_USER_PROFILE_FORM);

  const { data: profile, isLoading } = useQuery({
    queryKey: ['user-profile'],
    queryFn: async () => {
      const response = await fetch('/api/profile');
      if (!response.ok) {
        throw new Error('Failed to fetch profile');
      }
      return response.json();
    },
  });

  const { data: availableModels, isLoading: modelsLoading, refetch: refetchModels } = useQuery({
    queryKey: ['available-models'],
    queryFn: async () => {
      const response = await fetch('/api/ai/models');
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to fetch models');
      }
      return response.json();
    },
    enabled: false,
    retry: false,
  });

  useEffect(() => {
    if (profile) {
      setFormData({
        companyName: profile.companyName || '',
        industry: profile.industry || '',
        companySize: profile.companySize || '',
        website: profile.website || '',
        description: profile.description || '',
        service: profile.service || '',
        targetAudience: profile.targetAudience || '',
        valueProposition: profile.valueProposition || '',
        geminiApiKey: geminiKeyTouched ? formData.geminiApiKey : (profile.geminiApiKey || ''),
        googlePlacesApiKey: googlePlacesKeyTouched ? formData.googlePlacesApiKey : (profile.googlePlacesApiKey || ''),
        aiModel: profile.aiModel || 'gemini-2.0-flash',
        preferredCurrency: profile.preferredCurrency || 'USD',
        companyAddress: profile.companyAddress || '',
        companyEmail: profile.companyEmail || '',
        companyPhone: profile.companyPhone || '',
        taxId: profile.taxId || '',
        invoicePrefix: profile.invoicePrefix || 'INV',
        quotationPrefix: profile.quotationPrefix || 'QT',
        invoiceTerms: profile.invoiceTerms || 'Payment is due within 30 days',
        quotationTerms: profile.quotationTerms || 'This quotation is valid for 30 days from the date of issue',
        bankName: profile.bankName || '',
        accountName: profile.accountName || '',
        accountNumber: profile.accountNumber || '',
        routingNumber: profile.routingNumber || '',
        swiftCode: profile.swiftCode || '',
        iban: profile.iban || '',
        paymentInstructions: profile.paymentInstructions || '',
        templateStyle: profile.templateStyle || 'modern',
        primaryColor: profile.primaryColor || '#2563eb',
        secondaryColor: profile.secondaryColor || '#7c3aed',
        logoUrl: profile.logoUrl || '',
        headerText: profile.headerText || '',
        footerText: profile.footerText || '',
      });
      if (!geminiKeyTouched) setGeminiKeyTouched(false);
      if (!googlePlacesKeyTouched) setGooglePlacesKeyTouched(false);
    }
  }, [profile]);

  const updateProfileMutation = useMutation({
    mutationFn: async (data: UserProfileFormData) => {
      const response = await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        throw new Error('Failed to update profile');
      }
      return response.json();
    },
    onSuccess: (_data, variables) => {
      toast.success('Profile updated successfully');
      setGeminiKeyTouched(false);
      setGooglePlacesKeyTouched(false);
      queryClient.invalidateQueries({ queryKey: ['user-profile'] });
      if (variables.geminiApiKey && variables.geminiApiKey !== profile?.geminiApiKey && variables.geminiApiKey !== '••••••••') {
        setTimeout(() => refetchModels(), 500);
      }
    },
    onError: () => {
      toast.error('Failed to update profile');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateProfileMutation.mutate(formData);
  };

  const fetchDecryptedKey = async (keyType: 'geminiApiKey' | 'googlePlacesApiKey') => {
    try {
      if (keyType === 'geminiApiKey') {
        setLoadingGeminiKey(true);
      } else {
        setLoadingGooglePlacesKey(true);
      }

      const response = await fetch('/api/profile/decrypt-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyType }),
      });

      if (!response.ok) {
        throw new Error('Failed to decrypt key');
      }

      const data = await response.json();

      if (data.decryptedKey) {
        handleChange(keyType, data.decryptedKey);
        if (keyType === 'geminiApiKey') {
          setGeminiKeyTouched(true);
        } else {
          setGooglePlacesKeyTouched(true);
        }
      }
    } catch (error) {
      console.error('Error fetching decrypted key:', error);
      toast.error('Failed to load API key');
    } finally {
      if (keyType === 'geminiApiKey') {
        setLoadingGeminiKey(false);
      } else {
        setLoadingGooglePlacesKey(false);
      }
    }
  };

  const toggleGeminiKeyVisibility = async () => {
    if (!showGeminiKey && formData.geminiApiKey === '••••••••') {
      await fetchDecryptedKey('geminiApiKey');
    }
    setShowGeminiKey(!showGeminiKey);
  };

  const toggleGooglePlacesKeyVisibility = async () => {
    if (!showGooglePlacesKey && formData.googlePlacesApiKey === '••••••••') {
      await fetchDecryptedKey('googlePlacesApiKey');
    }
    setShowGooglePlacesKey(!showGooglePlacesKey);
  };

  const handleChange = (field: string, value: string | boolean | number) => {
    if (field === 'smtpPort') {
      setFormData(prev => ({ ...prev, [field]: parseInt(value as string) || 587 }));
    } else if (field === 'smtpSecure' || field === 'useAdminEmail') {
      setFormData(prev => ({ ...prev, [field]: value === 'true' || value === true }));
    } else {
      setFormData(prev => ({ ...prev, [field]: value }));
    }
  };

  return {
    formData,
    isLoading,
    showGeminiKey,
    showGooglePlacesKey,
    loadingGeminiKey,
    loadingGooglePlacesKey,
    availableModels,
    modelsLoading,
    updateProfileMutation,
    handleSubmit,
    handleChange,
    toggleGeminiKeyVisibility,
    toggleGooglePlacesKeyVisibility,
    setGeminiKeyTouched,
    setGooglePlacesKeyTouched,
    refetchModels,
  };
}
