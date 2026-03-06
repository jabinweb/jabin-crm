'use client';

import { useState, useEffect } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, DollarSign, TrendingUp, Award } from 'lucide-react';
import { useCurrency } from '@/hooks/use-currency';

interface Deal {
  id: string;
  title: string;
  value: number;
  currency: string;
  stage: string;
  probability: number;
  lead: {
    companyName: string;
    contactName?: string;
  };
}

interface PipelineStats {
  stages: Array<{
    stage: string;
    count: number;
    totalValue: number;
  }>;
  totalValue: number;
  weightedValue: number;
}

const STAGES = [
  { id: 'PROSPECTING', label: 'Prospecting', color: 'bg-gray-500' },
  { id: 'QUALIFICATION', label: 'Qualification', color: 'bg-blue-500' },
  { id: 'PROPOSAL', label: 'Proposal', color: 'bg-purple-500' },
  { id: 'NEGOTIATION', label: 'Negotiation', color: 'bg-orange-500' },
  { id: 'CLOSED_WON', label: 'Closed Won', color: 'bg-green-500' },
  { id: 'CLOSED_LOST', label: 'Closed Lost', color: 'bg-red-500' },
];

export default function DealsPage() {
  const [dealsByStage, setDealsByStage] = useState<Record<string, Deal[]>>({});
  const [stats, setStats] = useState<PipelineStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDeals();
    fetchStats();
  }, []);

  const fetchDeals = async () => {
    try {
      const res = await fetch('/api/deals');
      if (res.ok) {
        const deals: Deal[] = await res.json();
        
        // Group deals by stage
        const grouped = STAGES.reduce((acc, stage) => {
          acc[stage.id] = deals.filter((d) => d.stage === stage.id);
          return acc;
        }, {} as Record<string, Deal[]>);
        
        setDealsByStage(grouped);
      }
    } catch (error) {
      console.error('Failed to fetch deals:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const res = await fetch('/api/deals/stats');
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  };

  const onDragEnd = async (result: DropResult) => {
    const { source, destination, draggableId } = result;

    if (!destination) return;
    if (source.droppableId === destination.droppableId && source.index === destination.index) return;

    // Update local state optimistically
    const sourceLane = [...dealsByStage[source.droppableId]];
    const destLane = source.droppableId === destination.droppableId 
      ? sourceLane 
      : [...dealsByStage[destination.droppableId]];

    const [movedDeal] = sourceLane.splice(source.index, 1);
    destLane.splice(destination.index, 0, { ...movedDeal, stage: destination.droppableId });

    setDealsByStage({
      ...dealsByStage,
      [source.droppableId]: sourceLane,
      [destination.droppableId]: destLane,
    });

    // Update on server
    try {
      await fetch(`/api/deals/${draggableId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage: destination.droppableId }),
      });
      fetchStats(); // Refresh stats
    } catch (error) {
      console.error('Failed to update deal:', error);
      fetchDeals(); // Revert on error
    }
  };

  const { formatCurrency } = useCurrency();

  if (loading) {
    return <div className="container mx-auto p-4 md:p-6 lg:p-8">Loading deals...</div>;
  }

  return (
    <div className="container mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Deal Pipeline</h1>
          <p className="text-sm md:text-base text-muted-foreground">Track deals through your sales process</p>
        </div>
        <Button className="w-full sm:w-auto">
          <Plus className="mr-2 h-4 w-4" />
          New Deal
        </Button>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Pipeline</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(stats.totalValue)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Weighted Value</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(stats.weightedValue)}</div>
              <p className="text-xs text-muted-foreground">Based on probability</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Deals</CardTitle>
              <Award className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {stats?.stages?.reduce((sum, s) => sum + s.count, 0) ?? 0}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Kanban Board */}
      <DragDropContext onDragEnd={onDragEnd}>
        <div className="flex gap-4 overflow-x-auto pb-4">
          {STAGES.map((stage) => (
            <div key={stage.id} className="flex-shrink-0 w-80">
              <div className="mb-3">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${stage.color}`} />
                    {stage.label}
                  </h3>
                  <Badge variant="secondary">
                    {dealsByStage[stage.id]?.length || 0}
                  </Badge>
                </div>
                {stats && (
                  <p className="text-sm text-muted-foreground">
                    {formatCurrency(
                      stats.stages.find((s) => s.stage === stage.id)?.totalValue || 0
                    )}
                  </p>
                )}
              </div>

              <Droppable droppableId={stage.id}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={`min-h-[500px] p-2 rounded-lg transition-colors ${
                      snapshot.isDraggingOver ? 'bg-accent' : 'bg-muted/50'
                    }`}
                  >
                    {(dealsByStage[stage.id] || []).map((deal, index) => (
                      <Draggable key={deal.id} draggableId={deal.id} index={index}>
                        {(provided, snapshot) => (
                          <Card
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                            className={`mb-2 cursor-move ${
                              snapshot.isDragging ? 'shadow-lg ring-2 ring-primary' : ''
                            }`}
                          >
                            <CardHeader className="p-4">
                              <CardTitle className="text-sm font-semibold">
                                {deal.title}
                              </CardTitle>
                            </CardHeader>
                            <CardContent className="p-4 pt-0 space-y-2">
                              <div className="text-lg font-bold text-green-600">
                                {formatCurrency(deal.value, deal.currency as any)}
                              </div>
                              <div className="text-sm">
                                <p className="font-medium">{deal.lead.companyName}</p>
                                {deal.lead.contactName && (
                                  <p className="text-muted-foreground">{deal.lead.contactName}</p>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
                                  <div
                                    className="bg-primary h-full transition-all"
                                    style={{ width: `${deal.probability}%` }}
                                  />
                                </div>
                                <span className="text-xs font-medium">{deal.probability}%</span>
                              </div>
                            </CardContent>
                          </Card>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </div>
          ))}
        </div>
      </DragDropContext>
    </div>
  );
}
