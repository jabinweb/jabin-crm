'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ProfileCard } from '@/components/employee/profile-card'
import { toast } from '@/hooks/use-toast'
import { PageHeaderSkeleton, DetailSkeleton } from '@/components/loading'

interface Address {
  street: string
  city: string
  state: string
  zipCode: string
  country: string
}

interface EmergencyContact {
  name: string
  phone: string
  relation?: string
}

interface EmployeeProfile {
  id: string
  name: string
  email: string
  phone: string
  jobTitle: string
  department: string
  dateJoined: string
  role: string
  employmentType: string
  status: string
  avatar?: string
  address: Address | null
  dateOfBirth?: string | null
  gender?: string | null
  emergencyContact?: EmergencyContact | null
  company: {
    id: string
    name: string
    status: string
  }
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<EmployeeProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)

  const [phone, setPhone] = useState('')
  const [street, setStreet] = useState('')
  const [city, setCity] = useState('')
  const [state, setState] = useState('')
  const [zipCode, setZipCode] = useState('')
  const [country, setCountry] = useState('')
  const [dateOfBirth, setDateOfBirth] = useState('')
  const [gender, setGender] = useState('')
  const [ecName, setEcName] = useState('')
  const [ecPhone, setEcPhone] = useState('')
  const [ecRelation, setEcRelation] = useState('')

  useEffect(() => {
    void fetchProfile()
  }, [])

  const hydrateForm = (data: EmployeeProfile) => {
    setPhone(data.phone || '')
    setStreet(data.address?.street || '')
    setCity(data.address?.city || '')
    setState(data.address?.state || '')
    setZipCode(data.address?.zipCode || '')
    setCountry(data.address?.country || '')
    setDateOfBirth(
      data.dateOfBirth ? new Date(data.dateOfBirth).toISOString().slice(0, 10) : ''
    )
    setGender(data.gender || '')
    setEcName(data.emergencyContact?.name || '')
    setEcPhone(data.emergencyContact?.phone || '')
    setEcRelation(data.emergencyContact?.relation || '')
  }

  const fetchProfile = async () => {
    try {
      const response = await fetch('/api/employee/profile')
      if (!response.ok) throw new Error('Failed to fetch profile')
      const data = await response.json()
      setProfile(data)
      hydrateForm(data)
    } catch {
      toast({
        title: 'Error',
        description: 'Could not load profile data',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const saveProfile = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/employee/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone,
          address: { street, city, state, zipCode, country },
          dateOfBirth: dateOfBirth || null,
          gender: gender || null,
          emergencyContact:
            ecName && ecPhone
              ? { name: ecName, phone: ecPhone, relation: ecRelation || undefined }
              : null,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Save failed')
      }
      const data = await res.json()
      setProfile(data)
      hydrateForm(data)
      setEditing(false)
      toast({ title: 'Profile updated' })
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Could not save',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  const formatAddress = (address: Address | null) => {
    if (!address) return 'No address provided'
    return (
      <>
        {address.street}, {address.city}
        <br />
        {address.state}, {address.zipCode}
        <br />
        {address.country}
      </>
    )
  }

  if (loading) {
    return (
      <div className="container mx-auto p-4 space-y-6 max-w-lg lg:max-w-4xl">
        <PageHeaderSkeleton />
        <DetailSkeleton />
      </div>
    )
  }
  if (!profile) return null

  return (
    <div className="mx-auto max-w-lg space-y-5 p-1 pb-4 lg:max-w-4xl lg:p-6">
      <div className="flex justify-between items-center gap-3">
        <h1 className="text-xl font-semibold lg:text-2xl">My Profile</h1>
        {!editing ? (
          <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
            Edit
          </Button>
        ) : (
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                hydrateForm(profile)
                setEditing(false)
              }}
            >
              Cancel
            </Button>
            <Button size="sm" disabled={saving} onClick={saveProfile}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </div>
        )}
      </div>

      <div className="grid gap-5">
        <ProfileCard {...profile} companyName={profile.company.name} />

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Personal Information</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            {editing ? (
              <>
                <div className="space-y-2">
                  <Label>Phone</Label>
                  <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Street</Label>
                    <Input value={street} onChange={(e) => setStreet(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>City</Label>
                    <Input value={city} onChange={(e) => setCity(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>State</Label>
                    <Input value={state} onChange={(e) => setState(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>ZIP</Label>
                    <Input value={zipCode} onChange={(e) => setZipCode(e.target.value)} />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label>Country</Label>
                    <Input
                      value={country}
                      onChange={(e) => setCountry(e.target.value)}
                    />
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Date of birth</Label>
                    <Input
                      type="date"
                      value={dateOfBirth}
                      onChange={(e) => setDateOfBirth(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Gender</Label>
                    <Select value={gender || undefined} onValueChange={setGender}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Female">Female</SelectItem>
                        <SelectItem value="Male">Male</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                        <SelectItem value="Prefer not to say">
                          Prefer not to say
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-sm text-muted-foreground">Phone</p>
                  <p className="font-medium">{profile.phone || 'Not provided'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Date of birth</p>
                  <p className="font-medium">
                    {profile.dateOfBirth
                      ? new Date(profile.dateOfBirth).toLocaleDateString()
                      : 'Not provided'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Gender</p>
                  <p className="font-medium">{profile.gender || 'Not provided'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Address</p>
                  <p className="font-medium">{formatAddress(profile.address)}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Emergency contact</CardTitle>
          </CardHeader>
          <CardContent>
            {editing ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input value={ecName} onChange={(e) => setEcName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Phone</Label>
                  <Input value={ecPhone} onChange={(e) => setEcPhone(e.target.value)} />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label>Relation</Label>
                  <Input
                    value={ecRelation}
                    onChange={(e) => setEcRelation(e.target.value)}
                    placeholder="Spouse, parent…"
                  />
                </div>
              </div>
            ) : profile.emergencyContact ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="text-sm text-muted-foreground">Name</p>
                  <p className="font-medium">{profile.emergencyContact.name}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Phone</p>
                  <p className="font-medium">{profile.emergencyContact.phone}</p>
                </div>
                {profile.emergencyContact.relation && (
                  <div>
                    <p className="text-sm text-muted-foreground">Relation</p>
                    <p className="font-medium">{profile.emergencyContact.relation}</p>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No emergency contact set</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Employment Details</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-sm text-muted-foreground">Employee ID</p>
              <p className="font-medium">{profile.id}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Date Joined</p>
              <p className="font-medium">
                {new Date(profile.dateJoined).toLocaleDateString()}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Employment Type</p>
              <p className="font-medium">{profile.employmentType}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Role</p>
              <p className="font-medium">{profile.role}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
