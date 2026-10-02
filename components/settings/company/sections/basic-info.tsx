'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { ImageUpload } from "@/components/ui/image-upload"
import { useSettings } from "@/contexts/settings-context"
import type { SettingsUpdatePayload } from '@/types/settings'

interface BasicInfoSectionProps {
  onChange?: (changes: SettingsUpdatePayload) => void;
}

export function BasicInfoSection({ onChange }: BasicInfoSectionProps) {
  const { company, updateCompany, isUpdating } = useSettings()
  const [formData, setFormData] = useState({
    name: '',
    logo: '',
    email: '',
    phone: '',
    website: '',
    description: ''
  })

  useEffect(() => {
    if (company) {
      setFormData({
        name: company.name || '',
        logo: company.logo || '',
        email: company.email || '',
        phone: company.phone || '',
        website: company.website || '',
        description: company.description || ''
      })
    }
  }, [company])

  const handleChange = (key: string, value: string) => {
    const newData = {
      ...formData,
      [key]: value
    }
    setFormData(newData)
    onChange?.({ company: newData })
  }

  const fields: Array<{
    key: 'name' | 'email' | 'phone' | 'website'
    label: string
    type: string
    placeholder: string
    autoComplete: string
  }> = [
    { key: 'name', label: 'Company name', type: 'text', placeholder: 'Acme Pvt Ltd', autoComplete: 'organization' },
    { key: 'email', label: 'Email', type: 'email', placeholder: 'hello@acme.com', autoComplete: 'email' },
    { key: 'phone', label: 'Phone', type: 'tel', placeholder: '+91 98765 43210', autoComplete: 'tel' },
    { key: 'website', label: 'Website', type: 'url', placeholder: 'https://acme.com', autoComplete: 'url' },
  ]

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Company identity</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Company logo</Label>
            <ImageUpload
              value={formData.logo}
              onChange={(url) => handleChange('logo', url)}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {fields.map((field) => (
              <div key={field.key} className="grid gap-2">
                <Label htmlFor={`company-${field.key}`}>{field.label}</Label>
                <Input
                  id={`company-${field.key}`}
                  type={field.type}
                  placeholder={field.placeholder}
                  autoComplete={field.autoComplete}
                  value={formData[field.key]}
                  onChange={(e) => handleChange(field.key, e.target.value)}
                  disabled={isUpdating}
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
