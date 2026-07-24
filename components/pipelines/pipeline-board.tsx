'use client';

import { DragDropContext, Droppable, Draggable, type DropResult } from '@hello-pangea/dnd';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { PipelineStageDef } from '@/lib/pipelines';
import type { ReactNode } from 'react';

export type PipelineBoardCard = {
  id: string;
  stage: string;
};

type PipelineBoardProps<T extends PipelineBoardCard> = {
  columns: PipelineStageDef[];
  itemsByStage: Record<string, T[]>;
  onMove: (id: string, toStage: string, fromStage: string) => void | Promise<void>;
  renderCard: (item: T) => ReactNode;
  columnFooter?: (stageId: string, items: T[]) => ReactNode;
  className?: string;
};

export function PipelineBoard<T extends PipelineBoardCard>({
  columns,
  itemsByStage,
  onMove,
  renderCard,
  columnFooter,
  className,
}: PipelineBoardProps<T>) {
  const onDragEnd = (result: DropResult) => {
    const { source, destination, draggableId } = result;
    if (!destination) return;
    if (
      source.droppableId === destination.droppableId &&
      source.index === destination.index
    ) {
      return;
    }
    void onMove(draggableId, destination.droppableId, source.droppableId);
  };

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <div className={cn('flex gap-4 overflow-x-auto pb-4', className)}>
        {columns.map((stage) => {
          const items = itemsByStage[stage.id] || [];
          return (
            <div key={stage.id} className="flex-shrink-0 w-72 sm:w-80">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h3 className="font-semibold flex items-center gap-2 text-sm">
                  <span className={cn('h-2.5 w-2.5 rounded-full', stage.color)} />
                  {stage.label}
                </h3>
                <Badge variant="secondary">{items.length}</Badge>
              </div>
              {columnFooter?.(stage.id, items)}
              <Droppable droppableId={stage.id}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={cn(
                      'min-h-[420px] space-y-2 rounded-md border bg-muted/40 p-2 transition-colors',
                      snapshot.isDraggingOver && 'bg-accent/60'
                    )}
                  >
                    {items.map((item, index) => (
                      <Draggable key={item.id} draggableId={item.id} index={index}>
                        {(dragProvided, dragSnapshot) => (
                          <div
                            ref={dragProvided.innerRef}
                            {...dragProvided.draggableProps}
                            {...dragProvided.dragHandleProps}
                            className={cn(
                              'rounded-md border bg-background shadow-sm',
                              dragSnapshot.isDragging && 'ring-2 ring-primary'
                            )}
                          >
                            {renderCard(item)}
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </div>
          );
        })}
      </div>
    </DragDropContext>
  );
}

export function groupByStage<T extends PipelineBoardCard>(
  items: T[],
  columns: PipelineStageDef[]
): Record<string, T[]> {
  const grouped = columns.reduce(
    (acc, col) => {
      acc[col.id] = [];
      return acc;
    },
    {} as Record<string, T[]>
  );
  for (const item of items) {
    if (grouped[item.stage]) {
      grouped[item.stage].push(item);
    }
  }
  return grouped;
}
