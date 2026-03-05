'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface AITicketSummaryProps {
    ticketId: string;
    initialSummary?: any;
    className?: string;
}

export function AITicketSummary({ ticketId, initialSummary, className }: AITicketSummaryProps) {
    const [isGenerating, setIsGenerating] = useState(false);
    const [summary, setSummary] = useState<any>(initialSummary);

    const handleGenerate = async () => {
        setIsGenerating(true);
        try {
            const response = await fetch(`/api/tickets/${ticketId}/ai-summary`, {
                method: 'POST',
            });
            if (!response.ok) throw new Error('Failed to generate AI insights');
            const data = await response.json();
            setSummary(data);
            toast.success('AI Insights updated');
        } catch (error) {
            console.error('AI Summary Error:', error);
            toast.error('Could not generate AI summary at this time');
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <Card className={cn("border-blue-200 bg-blue-50/30 dark:border-blue-900 dark:bg-blue-950/20 shadow-sm", className)}>
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                        <Sparkles className="h-4 w-4 text-blue-600 animate-pulse" />
                        <CardTitle className="text-sm font-bold text-blue-900 dark:text-blue-100 uppercase tracking-widest">Gemini AI Insights</CardTitle>
                    </div>
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={handleGenerate}
                        disabled={isGenerating}
                        className="h-7 text-[10px] bg-white/50 backdrop-blur-sm border-blue-200 hover:bg-blue-100 hover:text-blue-700 transition-all uppercase font-bold"
                    >
                        {isGenerating ? 'Analyzing History...' : 'Refresh AI Analysis'}
                    </Button>
                </div>
            </CardHeader>
            <CardContent>
                {!summary && !isGenerating ? (
                    <div className="py-4 text-center space-y-2">
                        <p className="text-xs text-blue-700/70 dark:text-blue-300/70 italic">
                            Generate an AI-powered summary of the current situation and history.
                        </p>
                        <Button variant="link" size="sm" onClick={handleGenerate} className="text-blue-600 font-bold p-0 h-auto">
                            Analyze Ticket Now
                        </Button>
                    </div>
                ) : isGenerating ? (
                    <div className="space-y-3 py-2">
                        <div className="space-y-2">
                            <div className="h-3 bg-blue-200/50 animate-pulse rounded w-full" />
                            <div className="h-3 bg-blue-200/50 animate-pulse rounded w-5/6" />
                            <div className="h-3 bg-blue-200/50 animate-pulse rounded w-4/6" />
                        </div>
                    </div>
                ) : (
                    <div className="space-y-5">
                        <div className="space-y-1.5">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-blue-800/60 dark:text-blue-200/60">Executive Summary</p>
                            <p className="text-sm text-blue-900 dark:text-blue-100 leading-relaxed font-medium">
                                {summary.summary}
                            </p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-1.5">
                                <p className="text-[10px] font-bold uppercase tracking-wider text-blue-800/60 dark:text-blue-200/60">Suggested Next Steps</p>
                                <ul className="space-y-1.5">
                                    {summary.suggestedSteps?.map((step: string, i: number) => (
                                        <li key={i} className="text-xs flex items-start text-blue-900/80 dark:text-blue-100/80">
                                            <span className="mr-2 text-blue-500 font-bold">•</span>
                                            {step}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                            <div className="space-y-3">
                                <div className="space-y-1.5">
                                    <p className="text-[10px] font-bold uppercase tracking-wider text-blue-800/60 dark:text-blue-200/60">Priority Assessment</p>
                                    <Badge
                                        variant="outline"
                                        className={cn(
                                            "text-[10px] font-bold px-2.5 py-0.5 border-blue-200",
                                            summary.priorityScore === 'CRITICAL' ? "bg-red-100 text-red-700 border-red-200" :
                                                summary.priorityScore === 'HIGH' ? "bg-orange-100 text-orange-700 border-orange-200" :
                                                    "bg-blue-100/50 text-blue-700"
                                        )}
                                    >
                                        {summary.priorityScore}
                                    </Badge>
                                </div>
                                <div className="space-y-1.5">
                                    <p className="text-[10px] font-bold uppercase tracking-wider text-blue-800/60 dark:text-blue-200/60">Key Issues Identified</p>
                                    <div className="flex flex-wrap gap-1.5">
                                        {summary.keyIssues?.map((issue: string, i: number) => (
                                            <span key={i} className="text-[9px] px-2 py-0.5 rounded-full bg-blue-100/40 border border-blue-200/50 text-blue-800">
                                                {issue}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                        <p className="text-[9px] text-blue-700/40 dark:text-blue-300/20 italic pt-2 border-t border-blue-200/30">
                            Insights generated by Gemini 2.0 Flash based on ticket subject, description, and full activity history.
                        </p>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
