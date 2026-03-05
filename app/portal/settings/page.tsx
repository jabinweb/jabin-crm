'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
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
} from 'lucide-react';
import Link from 'next/link';
import { signOut } from 'next-auth/react';

export default function PortalSettingsPage() {
    const { data: session } = useSession();
    const { toast } = useToast();

    const [profile, setProfile] = useState({
        name: session?.user?.name ?? '',
        email: session?.user?.email ?? '',
        phone: '',
        address: '',
        hospitalName: '',
    });

    const [notifications, setNotifications] = useState({
        ticketUpdates: true,
        warrantyAlerts: true,
        maintenanceReminders: true,
        newsUpdates: false,
    });

    const handleSaveProfile = () => {
        // In a real implementation this would call an API route
        toast({ title: 'Profile saved', description: 'Your contact details have been updated.', variant: 'default' });
    };

    const handleSaveNotifications = () => {
        toast({ title: 'Preferences saved', description: 'Your notification preferences have been updated.' });
    };

    const Toggle = ({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) => (
        <button
            type="button"
            onClick={() => onChange(!value)}
            className={`relative inline-flex h-5 w-9 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${value ? 'bg-blue-600' : 'bg-slate-200 dark:bg-slate-700'}`}
        >
            <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-md ring-0 transition-transform mt-0.5 ${value ? 'translate-x-4' : 'translate-x-0.5'}`} />
        </button>
    );

    return (
        <div className="space-y-8 max-w-2xl">
            {/* Page Header */}
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" asChild className="rounded-full hover:bg-slate-100 dark:hover:bg-slate-800">
                    <Link href="/portal"><ChevronLeft className="h-4 w-4" /></Link>
                </Button>
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Settings</h1>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Manage your account and portal preferences.</p>
                </div>
            </div>

            {/* Profile Section */}
            <Card className="border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
                <CardHeader className="pb-4 border-b border-slate-50 dark:border-slate-800">
                    <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-lg bg-blue-600/10 flex items-center justify-center">
                            <User className="h-4.5 w-4.5 text-blue-600 h-5 w-5" />
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
                                <Input id="name" value={profile.name} onChange={e => setProfile(p => ({ ...p, name: e.target.value }))} className="pl-9 h-10 bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 focus:border-blue-500 focus:ring-blue-500" />
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
                            <Label htmlFor="hospital" className="text-xs font-semibold uppercase tracking-wide text-slate-500">Hospital / Facility Name</Label>
                            <div className="relative">
                                <Building2 className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                                <Input id="hospital" placeholder="e.g. City General Hospital" value={profile.hospitalName} onChange={e => setProfile(p => ({ ...p, hospitalName: e.target.value }))} className="pl-9 h-10 bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 focus:border-blue-500 focus:ring-blue-500" />
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="phone" className="text-xs font-semibold uppercase tracking-wide text-slate-500">Phone Number</Label>
                            <div className="relative">
                                <Phone className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                                <Input id="phone" placeholder="+1 555 000 0000" value={profile.phone} onChange={e => setProfile(p => ({ ...p, phone: e.target.value }))} className="pl-9 h-10 bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 focus:border-blue-500 focus:ring-blue-500" />
                            </div>
                        </div>
                        <div className="space-y-1.5 sm:col-span-2">
                            <Label htmlFor="address" className="text-xs font-semibold uppercase tracking-wide text-slate-500">Address</Label>
                            <div className="relative">
                                <MapPin className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                                <Input id="address" placeholder="123 Medical Drive, City, State" value={profile.address} onChange={e => setProfile(p => ({ ...p, address: e.target.value }))} className="pl-9 h-10 bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 focus:border-blue-500 focus:ring-blue-500" />
                            </div>
                        </div>
                    </div>
                    <div className="flex justify-end pt-1">
                        <Button onClick={handleSaveProfile} className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm shadow-blue-500/20 transition-all hover:scale-105 active:scale-95">
                            <Save className="h-4 w-4 mr-2" /> Save Profile
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* Notifications Section */}
            <Card className="border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
                <CardHeader className="pb-4 border-b border-slate-50 dark:border-slate-800">
                    <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-lg bg-purple-600/10 flex items-center justify-center">
                            <Bell className="h-5 w-5 text-purple-600" />
                        </div>
                        <div>
                            <CardTitle className="text-base">Notifications</CardTitle>
                            <CardDescription>Choose which alerts you want to receive.</CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="pt-6 space-y-5">
                    {[
                        { key: 'ticketUpdates', label: 'Ticket Updates', desc: 'Get notified when the status of your support tickets changes.' },
                        { key: 'warrantyAlerts', label: 'Warranty Alerts', desc: 'Receive alerts 30 days before equipment warranties expire.' },
                        { key: 'maintenanceReminders', label: 'Maintenance Reminders', desc: 'Get reminded when scheduled maintenance is due.' },
                        { key: 'newsUpdates', label: 'News & Updates', desc: 'Occasional product and service updates from Jabin.' },
                    ].map(({ key, label, desc }) => (
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
                        <Button onClick={handleSaveNotifications} className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm shadow-blue-500/20 transition-all hover:scale-105 active:scale-95">
                            <Save className="h-4 w-4 mr-2" /> Save Preferences
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* Security / Danger Zone */}
            <Card className="border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
                <CardHeader className="pb-4 border-b border-slate-50 dark:border-slate-800">
                    <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-lg bg-red-500/10 flex items-center justify-center">
                            <ShieldCheck className="h-5 w-5 text-red-500" />
                        </div>
                        <div>
                            <CardTitle className="text-base">Account</CardTitle>
                            <CardDescription>Security and session management.</CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-slate-900 dark:text-white">Sign Out</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">End your current portal session.</p>
                        </div>
                        <Button variant="outline" onClick={() => signOut({ callbackUrl: '/auth/signin' })} className="border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300 dark:border-red-800 dark:hover:bg-red-900/20 transition-all">
                            <LogOut className="h-4 w-4 mr-2" /> Sign Out
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
