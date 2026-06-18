'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sparkles, TrendingUp, Loader2 } from 'lucide-react';
import { type useLeadDetailPage } from '@/hooks/use-lead-detail-page';

type LeadDetailPageState = ReturnType<typeof useLeadDetailPage>;

interface LeadDetailActionsProps extends Pick<
  LeadDetailPageState,
  | 'aiSuggestions'
  | 'setAiSuggestions'
  | 'loadingAiSuggestions'
  | 'handleGetAISuggestions'
  | 'handleCreateTaskFromAI'
  | 'aiScoring'
  | 'aiScore'
  | 'handleAIScoring'
> {}

export function LeadDetailActions({
  aiSuggestions,
  setAiSuggestions,
  loadingAiSuggestions,
  handleGetAISuggestions,
  handleCreateTaskFromAI,
  aiScoring,
  aiScore,
  handleAIScoring,
}: LeadDetailActionsProps) {
  return (
    <>
      {aiSuggestions ? (
        <Card className="border-2 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-lg">
                <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center">
                  <Sparkles className="h-4 w-4 text-white" />
                </div>
                AI Task Suggestions
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={() => setAiSuggestions(null)}>
                Dismiss
              </Button>
            </div>
            <CardDescription className="text-sm mt-2">
              {aiSuggestions.insights}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {aiSuggestions.suggestions.map((suggestion, index) => (
              <div key={index} className="bg-white dark:bg-slate-900 rounded-lg p-4 space-y-2 border">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge
                        variant={
                          suggestion.priority === 'URGENT' ? 'destructive' :
                          suggestion.priority === 'HIGH' ? 'default' :
                          'secondary'
                        }
                        className="text-xs"
                      >
                        {suggestion.priority}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {suggestion.type}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        Due in {suggestion.dueInDays} {suggestion.dueInDays === 1 ? 'day' : 'days'}
                      </span>
                    </div>
                    <h4 className="font-semibold text-sm">{suggestion.title}</h4>
                    <p className="text-xs text-muted-foreground mt-1">{suggestion.reasoning}</p>
                    {suggestion.description && (
                      <p className="text-xs text-slate-600 dark:text-slate-400 mt-2 italic">
                        {suggestion.description}
                      </p>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleCreateTaskFromAI(suggestion)}
                    className="shrink-0"
                  >
                    Create Task
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : (
        <Card className="border-2 border-dashed">
          <CardContent className="py-8 text-center">
            <Button
              onClick={handleGetAISuggestions}
              disabled={loadingAiSuggestions}
              className="gap-2"
              variant="outline"
            >
              {loadingAiSuggestions ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Get AI Task Suggestions
                </>
              )}
            </Button>
            <p className="text-xs text-muted-foreground mt-2">
              AI will analyze this lead and suggest next best actions
            </p>
          </CardContent>
        </Card>
      )}

      <Card className="border-2 bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-950/20 dark:to-blue-950/20">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
                <Sparkles className="h-4 w-4 text-white" />
              </div>
              AI Lead Score
            </CardTitle>
            <Button
              size="sm"
              variant="outline"
              onClick={handleAIScoring}
              disabled={aiScoring}
              className="bg-white dark:bg-slate-900"
            >
              {aiScoring ? (
                <>
                  <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <TrendingUp className="mr-2 h-3 w-3" />
                  {aiScore ? 'Refresh' : 'Analyze'}
                </>
              )}
            </Button>
          </div>
          <CardDescription>
            AI-powered lead qualification and insights
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!aiScore ? (
            <div className="text-center py-8">
              <div className="mx-auto w-12 h-12 rounded-full bg-purple-100 dark:bg-purple-900 flex items-center justify-center mb-3">
                <Sparkles className="h-6 w-6 text-purple-600 dark:text-purple-400" />
              </div>
              <p className="text-sm text-muted-foreground">
                Click &quot;Analyze&quot; to get AI-powered lead insights
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white dark:bg-slate-900 rounded-lg p-4 border">
                  <p className="text-xs font-medium text-muted-foreground mb-1">Lead Quality</p>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={
                        aiScore.quality === 'HOT' ? 'default' :
                        aiScore.quality === 'WARM' ? 'secondary' :
                        'outline'
                      }
                      className="text-base font-bold px-3 py-1"
                    >
                      {aiScore.quality}
                    </Badge>
                    <span className="text-2xl font-bold">
                      {aiScore.score}
                      <span className="text-sm text-muted-foreground">/100</span>
                    </span>
                  </div>
                </div>
                <div className="bg-white dark:bg-slate-900 rounded-lg p-4 border">
                  <p className="text-xs font-medium text-muted-foreground mb-1">Conversion Probability</p>
                  <p className="text-3xl font-bold text-green-600">{aiScore.conversionProbability}%</p>
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900 rounded-lg p-4 border">
                <p className="text-xs font-medium text-muted-foreground mb-2">Analysis</p>
                <p className="text-sm leading-relaxed">{aiScore.reasoning}</p>
              </div>

              <div className="bg-white dark:bg-slate-900 rounded-lg p-4 border">
                <p className="text-xs font-medium text-muted-foreground mb-3">Recommended Next Steps</p>
                <ul className="space-y-2">
                  {aiScore.nextSteps.map((step, idx) => (
                    <li key={idx} className="text-sm flex items-start gap-2">
                      <span className="h-5 w-5 rounded-full bg-purple-100 dark:bg-purple-900 flex items-center justify-center text-xs font-bold text-purple-600 dark:text-purple-400 mt-0.5">
                        {idx + 1}
                      </span>
                      <span className="flex-1">{step}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
