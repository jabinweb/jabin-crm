'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Trash2, ArrowLeft, Sparkles, Loader2 } from 'lucide-react';
import { DashboardLink } from '@/components/navigation/dashboard-link';
import { useWorkspacePaths } from '@/hooks/use-workspace-paths';
import { toast } from 'sonner';

interface SequenceStep {
  stepNumber: number;
  name: string;
  subject: string;
  body: string;
  delayDays: number;
  delayHours: number;
  condition: string | null;
}

export default function NewSequencePage() {
  const router = useRouter();
  const { path } = useWorkspacePaths();
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [showAIDialog, setShowAIDialog] = useState(false);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiParams, setAiParams] = useState({
    goal: '',
    targetPersona: '',
    tone: 'professional',
    stepCount: 3,
    companyInfo: '',
    productService: '',
  });
  const [steps, setSteps] = useState<SequenceStep[]>([
    {
      stepNumber: 1,
      name: 'Initial Outreach',
      subject: '',
      body: '',
      delayDays: 0,
      delayHours: 0,
      condition: null,
    },
  ]);

  const addStep = () => {
    setSteps([
      ...steps,
      {
        stepNumber: steps.length + 1,
        name: `Follow-up ${steps.length}`,
        subject: '',
        body: '',
        delayDays: 2,
        delayHours: 0,
        condition: 'NO_REPLY',
      },
    ]);
  };

  const removeStep = (index: number) => {
    if (steps.length > 1) {
      setSteps(steps.filter((_, i) => i !== index).map((step, i) => ({
        ...step,
        stepNumber: i + 1,
      })));
    }
  };

  const updateStep = (index: number, field: keyof SequenceStep, value: any) => {
    const newSteps = [...steps];
    newSteps[index] = { ...newSteps[index], [field]: value };
    setSteps(newSteps);
  };

  const handleGenerateWithAI = async () => {
    if (!aiParams.goal || !aiParams.targetPersona) {
      toast.error('Please provide goal and target persona');
      return;
    }

    setAiGenerating(true);
    toast.loading('Generating sequence…', { id: 'ai-sequence' });

    try {
      const res = await fetch('/api/ai/generate-sequence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(aiParams),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to generate sequence');
      }

      const data = await res.json();
      const aiSequence = data.sequence;

      // Set sequence name and description
      setName(aiSequence.name);
      setDescription(aiSequence.description);

      // Convert AI steps to our format
      const generatedSteps: SequenceStep[] = aiSequence.steps.map((step: any) => ({
        stepNumber: step.order,
        name: `Step ${step.order}`,
        subject: step.subject,
        body: step.body,
        delayDays: step.delayDays,
        delayHours: step.delayHours,
        condition: step.condition || null,
      }));

      setSteps(generatedSteps);
      setShowAIDialog(false);
      toast.success(`Generated a ${generatedSteps.length}-step sequence. Review it before saving.`, {
        id: 'ai-sequence',
      });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to generate sequence',
        { id: 'ai-sequence' }
      );
    } finally {
      setAiGenerating(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);

    try {
      const res = await fetch('/api/sequences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description, steps }),
      });

      if (res.ok) {
        toast.success('Sequence created');
        router.push(path('/dashboard/sequences'));
      } else {
        const error = await res.json().catch(() => ({}));
        toast.error(error.error || 'Failed to create sequence');
      }
    } catch (error) {
      console.error('Failed to create sequence:', error);
      toast.error('Failed to create sequence');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
        <div className="min-w-0 space-y-1">
          <Button
            asChild
            variant="ghost"
            size="icon"
            className="-ml-2 h-10 w-10 sm:h-9 sm:w-9"
          >
            <DashboardLink href="/dashboard/sequences" aria-label="Back to sequences">
              <ArrowLeft className="h-4 w-4" />
            </DashboardLink>
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Create Email Sequence</h1>
            <p className="text-muted-foreground">
              Emails that send automatically, with follow-ups based on how each lead responds
            </p>
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={() => setShowAIDialog(true)}
          className="gap-2 self-start sm:self-auto"
        >
          <Sparkles className="h-4 w-4" />
          Generate with AI
        </Button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Info */}
        <Card>
          <CardHeader>
            <CardTitle>Sequence Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Sequence Name *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Cold Outreach - SaaS Companies"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe the purpose of this sequence..."
                rows={3}
              />
            </div>
          </CardContent>
        </Card>

        {/* Steps */}
        {steps.map((step, index) => (
          <Card key={index}>
            <CardHeader>
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="min-w-0 break-words text-lg">
                  Step {step.stepNumber}: {step.name}
                </CardTitle>
                {steps.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-10 w-10 shrink-0"
                    aria-label={`Remove step ${step.stepNumber}`}
                    onClick={() => removeStep(index)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor={`step-${index}-name`}>Step Name</Label>
                  <Input
                    id={`step-${index}-name`}
                    value={step.name}
                    onChange={(e) => updateStep(index, 'name', e.target.value)}
                    placeholder="e.g., Initial Outreach"
                  />
                </div>
                {index > 0 && (
                  <div className="space-y-2">
                    <Label htmlFor={`step-${index}-condition`}>Send If</Label>
                    <Select
                      value={step.condition || 'NO_REPLY'}
                      onValueChange={(value) => updateStep(index, 'condition', value)}
                    >
                      <SelectTrigger id={`step-${index}-condition`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="NO_REPLY">No reply</SelectItem>
                        <SelectItem value="NO_OPEN">Not opened</SelectItem>
                        <SelectItem value="OPENED">Email opened</SelectItem>
                        <SelectItem value="CLICKED">Link clicked</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              {index > 0 && (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor={`step-${index}-days`}>Delay (Days)</Label>
                    <Input
                      id={`step-${index}-days`}
                      type="number"
                      inputMode="numeric"
                      min="0"
                      value={Number.isFinite(step.delayDays) ? step.delayDays : ''}
                      onChange={(e) =>
                        updateStep(
                          index,
                          'delayDays',
                          Math.max(0, parseInt(e.target.value, 10) || 0)
                        )
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`step-${index}-hours`}>Additional Hours</Label>
                    <Input
                      id={`step-${index}-hours`}
                      type="number"
                      inputMode="numeric"
                      min="0"
                      max="23"
                      value={Number.isFinite(step.delayHours) ? step.delayHours : ''}
                      onChange={(e) =>
                        updateStep(
                          index,
                          'delayHours',
                          Math.min(23, Math.max(0, parseInt(e.target.value, 10) || 0))
                        )
                      }
                    />
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor={`step-${index}-subject`}>Email Subject *</Label>
                <Input
                  id={`step-${index}-subject`}
                  value={step.subject}
                  onChange={(e) => updateStep(index, 'subject', e.target.value)}
                  placeholder="Use {{companyName}}, {{contactName}} for personalization"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor={`step-${index}-body`}>Email Body *</Label>
                <Textarea
                  id={`step-${index}-body`}
                  value={step.body}
                  onChange={(e) => updateStep(index, 'body', e.target.value)}
                  placeholder="Hi {{contactName}},&#10;&#10;I noticed {{companyName}} is..."
                  rows={8}
                  required
                />
                <p className="break-words text-xs text-muted-foreground">
                  Available variables: {'{{companyName}}, {{contactName}}, {{email}}, {{phone}}, {{website}}'}
                </p>
              </div>
            </CardContent>
          </Card>
        ))}

        {/* Add Step Button */}
        <Button type="button" variant="outline" onClick={addStep} className="w-full">
          <Plus className="mr-2 h-4 w-4" />
          Add Follow-up Step
        </Button>

        {/* Submit */}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:gap-4">
          <Button asChild variant="outline" className="flex-1">
            <DashboardLink href="/dashboard/sequences">Cancel</DashboardLink>
          </Button>
          <Button type="submit" disabled={loading} className="flex-1">
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating…
              </>
            ) : (
              'Create Sequence'
            )}
          </Button>
        </div>
      </form>

      {/* AI Generation Dialog */}
      <Dialog open={showAIDialog} onOpenChange={setShowAIDialog}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Generate Sequence with AI
            </DialogTitle>
            <DialogDescription>
              Let AI create a complete email sequence based on your goals. You can edit the generated steps afterwards.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="aiGoal">Sequence Goal *</Label>
              <Input
                id="aiGoal"
                placeholder="e.g., Book discovery calls with HR managers"
                value={aiParams.goal}
                onChange={(e) => setAiParams({ ...aiParams, goal: e.target.value })}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="aiPersona">Target Persona *</Label>
              <Input
                id="aiPersona"
                placeholder="e.g., HR Directors at companies with 100-500 employees"
                value={aiParams.targetPersona}
                onChange={(e) => setAiParams({ ...aiParams, targetPersona: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="aiTone">Tone</Label>
                <Select value={aiParams.tone} onValueChange={(value) => setAiParams({ ...aiParams, tone: value })}>
                  <SelectTrigger id="aiTone">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="professional">Professional</SelectItem>
                    <SelectItem value="casual">Casual</SelectItem>
                    <SelectItem value="friendly">Friendly</SelectItem>
                    <SelectItem value="formal">Formal</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="aiStepCount">Number of Steps</Label>
                <Select
                  value={aiParams.stepCount.toString()}
                  onValueChange={(value) => setAiParams({ ...aiParams, stepCount: parseInt(value) })}
                >
                  <SelectTrigger id="aiStepCount">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="2">2 steps</SelectItem>
                    <SelectItem value="3">3 steps</SelectItem>
                    <SelectItem value="4">4 steps</SelectItem>
                    <SelectItem value="5">5 steps</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="aiCompany">Your Company Info (Optional)</Label>
              <Textarea
                id="aiCompany"
                placeholder="e.g., We are a SaaS platform for employee engagement..."
                rows={2}
                value={aiParams.companyInfo}
                onChange={(e) => setAiParams({ ...aiParams, companyInfo: e.target.value })}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="aiProduct">Product/Service (Optional)</Label>
              <Textarea
                id="aiProduct"
                placeholder="e.g., Employee pulse surveys, performance reviews, 1-on-1 tools"
                rows={2}
                value={aiParams.productService}
                onChange={(e) => setAiParams({ ...aiParams, productService: e.target.value })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowAIDialog(false)}
              disabled={aiGenerating}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleGenerateWithAI}
              disabled={aiGenerating || !aiParams.goal || !aiParams.targetPersona}
              className="gap-2"
            >
              {aiGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Generate Sequence
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
