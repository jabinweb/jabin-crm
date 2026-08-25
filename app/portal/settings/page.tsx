'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import {
    ChevronLeft,
    User,
    Building2,
    Phone,
    Mail,
    MapPin,
    Save,
    Bell,
    ShieldCheck,
    LogOut,
    Loader2,
    Lock,
    Eye,
    EyeOff,
} from 'lucide-react';
import Link from 'next/link';
import { signOut } from 'next-auth/react';
import { FormSkeleton } from '@/components/loading';
import { useWorkspaceConfig } from '@/hooks/use-workspace-config';

export default function PortalSettingsPage() {
    const { data: session } = useSession();
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const { data: workspaceData } = useWorkspaceConfig();
    const showWarrantyPrefs = workspaceData?.config.features?.warranties === true;
    const showMaintenancePrefs = workspaceData?.config.features?.serviceHistory === true;
    const [savingProfile, setSavingProfile] = useState(false);
    const [savingNotifications, setSavingNotifications] = useState(false);
    const [savingPassword, setSavingPassword] = useState(false);
    const [showCurrentPassword, setShowCurrentPassword] = useState(false);
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirm: '' });

    const { data: profileData, isLoading } = useQuery({
        queryKey: ['portal-profile'],
        queryFn: async () => {
            const res = await fetch('/api/portal/profile');
            if (!res.ok) throw new Error('Failed to load profile');
            return res.json();
        },
    });

    const { data: settingsData } = useQuery({
        queryKey: ['portal-settings'],
        queryFn: async () => {
            const res = await fetch('/api/portal/settings');
            if (!res.ok) throw new Error('Failed to load settings');
            return res.json();
        },
    });

    const [profile, setProfile] = useState({
        name: '',
        email: '',
        phone: '',
        address: '',
        organizationName: '',
    });

    useEffect(() => {
        if (profileData) {
            setProfile({
                name: profileData.name ?? session?.user?.name ?? '',
                email: profileData.email ?? session?.user?.email ?? '',
                phone: profileData.phone ?? '',
                address: profileData.address ?? '',
                organizationName: profileData.organizationName ?? '',
            });
        }
    }, [profileData, session]);

    const [notifications, setNotifications] = useState({
        ticketUpdates: true,
        warrantyAlerts: true,
        maintenanceReminders: true,
        newsUpdates: false,
        emailEnabled: true,
    });

    useEffect(() => {
        if (settingsData?.notifications) {
            setNotifications((prev) => ({ ...prev, ...settingsData.notifications }));
        }
    }, [settingsData]);

    const handleSaveProfile = async () => {
        setSavingProfile(true);
        try {
            const res = await fetch('/api/portal/profile', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(profile),
            });
            if (!res.ok) throw new Error('Failed to save');
            queryClient.invalidateQueries({ queryKey: ['portal-profile'] });
            toast({ title: 'Profile saved', description: 'Your contact details have been updated.' });
        } catch {
            toast({ title: 'Error', description: 'Could not save profile.', variant: 'destructive' });
        } finally {
            setSavingProfile(false);
        }
    };

    const handleSaveNotifications = async () => {
        setSavingNotifications(true);
        try {
            const res = await fetch('/api/portal/settings', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ notifications }),
            });
            if (!res.ok) throw new Error('Failed to save');
            queryClient.invalidateQueries({ queryKey: ['portal-settings'] });
            toast({ title: 'Preferences saved', description: 'Notification settings updated.' });
        } catch {
            toast({ title: 'Error', description: 'Could not save preferences.', variant: 'destructive' });
        } finally {
            setSavingNotifications(false);
        }
    };

    const handleChangePassword = async () => {
        if (passwordForm.newPassword !== passwordForm.confirm) {
            toast({ title: 'Passwords do not match', variant: 'destructive' });
            return;
        }
        setSavingPassword(true);
        try {
            const res = await fetch('/api/portal/profile/password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    currentPassword: passwordForm.currentPassword,
                    newPassword: passwordForm.newPassword,
                }),
            });
            const body = await res.json();
            if (!res.ok) throw new Error(body.error || 'Failed to update password');
            setPasswordForm({ currentPassword: '', newPassword: '', confirm: '' });
            toast({ title: 'Password updated', description: 'Use your new password next time you sign in.' });
        } catch (err) {
            toast({
                title: 'Error',
                description: err instanceof Error ? err.message : 'Could not update password.',
                variant: 'destructive',
            });
        } finally {
            setSavingPassword(false);
        }
    };

    const Toggle = ({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) => (
        <button
            type="button"
            onClick={() => onChange(!value)}
            className={`relative inline-flex h-5 w-9 rounded-none transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${value ? 'bg-blue-600' : 'bg-slate-200 dark:bg-slate-700'}`}
        >
            <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-none bg-white shadow-none ring-0 transition-transform mt-0.5 ${value ? 'translate-x-4' : 'translate-x-0.5'}`} />
        </button>
    );

    const notificationItems = [
        { key: 'emailEnabled', label: 'Email notifications', desc: 'Master switch for emails to your portal address.' },
        { key: 'ticketUpdates', label: 'Ticket updates', desc: 'Status changes and replies from our team.' },
        ...(showWarrantyPrefs
            ? [{ key: 'warrantyAlerts', label: 'Warranty alerts', desc: 'Reminders before equipment warranties expire.' }]
            : []),
        ...(showMaintenancePrefs
            ? [{ key: 'maintenanceReminders', label: 'Maintenance reminders', desc: 'Service reports and scheduled maintenance.' }]
            : []),
        { key: 'newsUpdates', label: 'News & updates', desc: 'Occasional product and service announcements.' },
    ] as const;

    if (isLoading) {
        return <FormSkeleton fields={5} withHeader />;
    }

    return (
        <div className="w-full space-y-8">
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" asChild className="rounded-none hover:bg-slate-100 dark:hover:bg-slate-800">
                    <Link href="/portal"><ChevronLeft className="h-4 w-4" /></Link>
                </Button>
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Settings</h1>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Manage your account and portal preferences.</p>
                </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
            <Card className="border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-none">
                <CardHeader className="pb-4 border-b border-slate-50 dark:border-slate-800">
                    <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-none bg-blue-600/10 flex items-center justify-center">
                            <User className="h-5 w-5 text-blue-600" />
                        </div>
                        <div>
                            <CardTitle className="text-base">Contact Information</CardTitle>
                            <CardDescription>Your profile details shared with the support team.</CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="pt-6 space-y-5">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                        <div className="space-y-1.5">
                            <Label htmlFor="name" className="text-xs font-semibold uppercase tracking-wide text-slate-500">Full Name</Label>
                            <div className="relative">
                                <User className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                                <Input id="name" value={profile.name} onChange={e => setProfile(p => ({ ...p, name: e.target.value }))} className="pl-9 h-10 bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700" />
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="email" className="text-xs font-semibold uppercase tracking-wide text-slate-500">Email Address</Label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                                <Input id="email" value={profile.email} disabled className="pl-9 h-10 bg-slate-100 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 cursor-not-allowed opacity-70" />
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="organization" className="text-xs font-semibold uppercase tracking-wide text-slate-500">Organization name</Label>
                            <div className="relative">
                                <Building2 className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                                <Input id="organization" placeholder="e.g. Acme Corporation" value={profile.organizationName} onChange={e => setProfile(p => ({ ...p, organizationName: e.target.value }))} className="pl-9 h-10 bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700" />
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="phone" className="text-xs font-semibold uppercase tracking-wide text-slate-500">Phone Number</Label>
                            <div className="relative">
                                <Phone className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                                <Input id="phone" placeholder="+1 555 000 0000" value={profile.phone} onChange={e => setProfile(p => ({ ...p, phone: e.target.value }))} className="pl-9 h-10 bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700" />
                            </div>
                        </div>
                        <div className="space-y-1.5 sm:col-span-2">
                            <Label htmlFor="address" className="text-xs font-semibold uppercase tracking-wide text-slate-500">Address</Label>
                            <div className="relative">
                                <MapPin className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                                <Input id="address" placeholder="123 Business Park, City, State" value={profile.address} onChange={e => setProfile(p => ({ ...p, address: e.target.value }))} className="pl-9 h-10 bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700" />
                            </div>
                        </div>
                    </div>
                    <div className="flex justify-end pt-1">
                        <Button onClick={handleSaveProfile} disabled={savingProfile} className="bg-blue-600 hover:bg-blue-700 text-white">
                            {savingProfile ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                            Save Profile
                        </Button>
                    </div>
                </CardContent>
            </Card>

            <Card className="border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-none">
                <CardHeader className="pb-4 border-b border-slate-50 dark:border-slate-800">
                    <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-none bg-purple-600/10 flex items-center justify-center">
                            <Bell className="h-5 w-5 text-purple-600" />
                        </div>
                        <div>
                            <CardTitle className="text-base">Notifications</CardTitle>
                            <CardDescription>Control in-app alerts and emails for your account.</CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="pt-6 space-y-5">
                    {notificationItems.map(({ key, label, desc }) => (
                        <div key={key} className="flex items-center justify-between">
                            <div className="flex-1 pr-4">
                                <p className="text-sm font-medium text-slate-900 dark:text-white">{label}</p>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{desc}</p>
                            </div>
                            <Toggle
                                value={notifications[key as keyof typeof notifications]}
                                onChange={v => setNotifications(n => ({ ...n, [key]: v }))}
                            />
                        </div>
                    ))}
                    <div className="flex justify-end pt-1">
                        <Button onClick={handleSaveNotifications} disabled={savingNotifications} className="bg-blue-600 hover:bg-blue-700 text-white">
                            {savingNotifications ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                            Save Preferences
                        </Button>
                    </div>
                </CardContent>
            </Card>
            </div>

            <Card className="border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-none">
                <CardHeader className="pb-4 border-b border-slate-50 dark:border-slate-800">
                    <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-none bg-red-500/10 flex items-center justify-center">
                            <ShieldCheck className="h-5 w-5 text-red-500" />
                        </div>
                        <div>
                            <CardTitle className="text-base">Account & security</CardTitle>
                            <CardDescription>Password and session management.</CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="pt-6 space-y-6">
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        <div className="space-y-1.5">
                            <Label htmlFor="currentPassword">Current password</Label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                                <Input
                                    id="currentPassword"
                                    type={showCurrentPassword ? 'text' : 'password'}
                                    value={passwordForm.currentPassword}
                                    onChange={(e) => setPasswordForm((p) => ({ ...p, currentPassword: e.target.value }))}
                                    className="pl-9 pr-9 h-10"
                                />
                                <button type="button" className="absolute right-3 top-2.5 text-slate-400" onClick={() => setShowCurrentPassword((v) => !v)}>
                                    {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </button>
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="newPassword">New password</Label>
                            <div className="relative">
                                <Input
                                    id="newPassword"
                                    type={showNewPassword ? 'text' : 'password'}
                                    value={passwordForm.newPassword}
                                    onChange={(e) => setPasswordForm((p) => ({ ...p, newPassword: e.target.value }))}
                                    className="pr-9 h-10"
                                />
                                <button type="button" className="absolute right-3 top-2.5 text-slate-400" onClick={() => setShowNewPassword((v) => !v)}>
                                    {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </button>
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="confirmPassword">Confirm new password</Label>
                            <Input
                                id="confirmPassword"
                                type={showNewPassword ? 'text' : 'password'}
                                value={passwordForm.confirm}
                                onChange={(e) => setPasswordForm((p) => ({ ...p, confirm: e.target.value }))}
                                className="h-10"
                            />
                        </div>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <Link href="/auth/forgot-password" className="text-sm text-blue-600 hover:underline">
                            Forgot password?
                        </Link>
                        <Button onClick={handleChangePassword} disabled={savingPassword} variant="outline">
                            {savingPassword ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Lock className="h-4 w-4 mr-2" />}
                            Update password
                        </Button>
                    </div>
                    <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800 pt-4">
                        <div>
                            <p className="text-sm font-medium text-slate-900 dark:text-white">Sign Out</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">End your current portal session.</p>
                        </div>
                        <Button variant="outline" onClick={() => signOut({ callbackUrl: '/auth/signin' })} className="border-red-200 text-red-600 hover:bg-red-50">
                            <LogOut className="h-4 w-4 mr-2" /> Sign Out
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
