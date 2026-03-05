'use client';

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    CardDescription
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { ChevronLeft, Send, Sparkles, LifeBuoy } from 'lucide-react';
import { toast } from 'sonner';

export default function NewCustomerTicketPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const equipmentIdParam = searchParams.get('equipmentId');

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [formData, setFormData] = useState({
        subject: '',
        description: '',
        priority: 'MEDIUM',
        equipmentId: equipmentIdParam || '',
    });

    const { data: equipmentOptions } = useQuery({
        queryKey: ['portal-equipment-options'],
        queryFn: async () => {
            const response = await fetch('/api/portal/equipment/options');
            if (!response.ok) return [];
            return response.json();
        }
    });

    useEffect(() => {
        if (equipmentIdParam) {
            setFormData(prev => ({ ...prev, equipmentId: equipmentIdParam }));
        }
    }, [equipmentIdParam]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.subject.trim() || !formData.description.trim()) {
            toast.error('Please fill in all required fields');
            return;
        }

        setIsSubmitting(true);
        try {
            const response = await fetch('/api/tickets', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData),
            });

            if (!response.ok) throw new Error('Failed to create ticket');

            toast.success('Support request submitted successfully');
            router.push('/portal/tickets');
        } catch (error) {
            toast.error('Failed to submit support request');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <div className="flex items-center space-x-4">
                <Button variant="ghost" size="icon" onClick={() => router.push('/portal/tickets')} className="rounded-full">
                    <ChevronLeft className="h-4 w-4" />
                </Button>
                <div>
                    <h1 className="text-2xl font-bold ">Submit Support Request</h1>
                    <p className="text-sm text-slate-500">Provide details about the issue for a priority resolution.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                    <Card className="border-none bg-white dark:bg-slate-900 shadow-sm border-t-4 border-t-blue-600">
                        <CardHeader>
                            <CardTitle className="text-lg">Request Details</CardTitle>
                            <CardDescription>Our technical team will be alerted immediately upon submission.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={handleSubmit} className="space-y-6">
                                <div className="space-y-2">
                                    <Label htmlFor="equipment" className="text-xs font-bold uppercase text-slate-400">Affected Unit (Priority Triage)</Label>
                                    <Select
                                        value={formData.equipmentId}
                                        onValueChange={(val) => setFormData({ ...formData, equipmentId: val })}
                                    >
                                        <SelectTrigger className="h-11 border-slate-100 bg-slate-50/50">
                                            <SelectValue placeholder="Select a medical device..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="GENERAL">Infrastructure / General Facility Support</SelectItem>
                                            {equipmentOptions?.map((opt: any) => (
                                                <SelectItem key={opt.id} value={opt.id}>
                                                    {opt.label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="subject" className="text-xs font-bold uppercase text-slate-400">Summary / Subject</Label>
                                    <Input
                                        id="subject"
                                        placeholder="Briefly describe the symptom (e.g., Ventilator fail-safe active)"
                                        className="h-11 border-slate-100 bg-slate-50/50 focus:bg-white transition-all"
                                        value={formData.subject}
                                        onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                                        required
                                    />
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <Label htmlFor="priority" className="text-xs font-bold uppercase text-slate-400">Impact Assessment</Label>
                                        <Select
                                            value={formData.priority}
                                            onValueChange={(val) => setFormData({ ...formData, priority: val })}
                                        >
                                            <SelectTrigger className="h-11 border-slate-100 bg-slate-50/50">
                                                <SelectValue placeholder="Select priority..." />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="LOW">Low - General Question</SelectItem>
                                                <SelectItem value="MEDIUM">Medium - Performance Issue</SelectItem>
                                                <SelectItem value="HIGH">High - Partial Downtime</SelectItem>
                                                <SelectItem value="CRITICAL">Critical - Life Support Threat</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="description" className="text-xs font-bold uppercase text-slate-400">Detailed Description</Label>
                                    <Textarea
                                        id="description"
                                        placeholder="Describe error codes, frequency, and patient impact..."
                                        className="min-h-[180px] border-slate-100 bg-slate-50/50 focus:bg-white transition-all resize-none"
                                        value={formData.description}
                                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                        required
                                    />
                                </div>

                                <div className="bg-blue-50/50 dark:bg-blue-900/10 p-5 rounded-xl flex items-start space-x-4 border border-blue-100/50 dark:border-blue-800/30 shadow-sm shadow-blue-500/5">
                                    <div className="p-2 bg-blue-600 rounded-lg">
                                        <Sparkles className="h-4 w-4 text-white" />
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-sm font-bold text-blue-900 dark:text-blue-100">Smart Routing Active</p>
                                        <p className="text-xs text-blue-700/80 dark:text-blue-200/60 leading-relaxed">
                                            Our system will automatically analyze your report, verify parts availability, and dispatch the closest qualified technician to your facility.
                                        </p>
                                    </div>
                                </div>

                                <div className="flex justify-end space-x-4 pt-6 border-t border-slate-50 mt-8">
                                    <Button variant="ghost" onClick={() => router.push('/portal/tickets')} type="button" className="text-slate-500">Cancel</Button>
                                    <Button type="submit" disabled={isSubmitting} className="min-w-[180px] bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-500/20 py-6 h-auto">
                                        {isSubmitting ? 'Dispatching...' : 'Dispatch Request'}
                                        <Send className="ml-2 h-4 w-4" />
                                    </Button>
                                </div>
                            </form>
                        </CardContent>
                    </Card>
                </div>

                <div className="space-y-6">
                    <Card className="border-none bg-slate-900 dark:bg-slate-800 text-white shadow-xl overflow-hidden relative">
                        <div className="absolute top-[-20px] right-[-20px] h-32 w-32 bg-blue-600 rounded-full blur-[60px] opacity-40" />
                        <CardHeader className="relative z-10">
                            <CardTitle className="text-base">Support SLA</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4 relative z-10">
                            <div className="flex items-center space-x-3 p-3 rounded-xl bg-white/5 border border-white/10">
                                <div className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                                <span className="text-xs font-semibold">Critical: 2-4 Hours</span>
                            </div>
                            <div className="flex items-center space-x-3 p-3 rounded-xl bg-white/5 border border-white/10">
                                <div className="h-2 w-2 rounded-full bg-orange-500" />
                                <span className="text-xs font-semibold">High: Next Day Resolution</span>
                            </div>
                            <div className="flex items-center space-x-3 p-3 rounded-xl bg-white/5 border border-white/10">
                                <div className="h-2 w-2 rounded-full bg-blue-500" />
                                <span className="text-xs font-semibold">Standard: 48-72 Hours</span>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-none bg-white dark:bg-slate-900 shadow-sm border-l-4 border-l-orange-400">
                        <CardHeader>
                            <CardTitle className="text-base">Emergency Contact</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <p className="text-xs text-slate-500 leading-relaxed">If this is a life-critical equipment failure during non-business hours, please contact our 24/7 hotline directly:</p>
                            <div className="p-4 rounded-xl bg-orange-50 dark:bg-orange-900/10 border border-orange-100 dark:border-orange-800/30 text-center">
                                <p className="text-lg font-bold text-orange-700">+1 (800) JABIN-MED</p>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
