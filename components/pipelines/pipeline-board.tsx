'use client';

import { DragDropContext, Droppable, Draggable, type DropResult } from '@hello-pangea/dnd';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  UNMAPPED_STAGE_ID,
  columnsWithUnmapped,
  type PipelineStageDef,
} from '@/lib/pipelines';
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
  /** Shown when every mapped column is empty */
  emptyState?: ReactNode;
  className?: string;
};

export function PipelineBoard<T extends PipelineBoardCard>({
  columns,
  itemsByStage,
  onMove,
  renderCard,
  columnFooter,
  emptyState,
  className,
}: PipelineBoardProps<T>) {
  const onDragEnd = (result: DropResult) => {
    const { source, destination, draggableId } = result;
    if (!destination) return;
    if (destination.droppableId === UNMAPPED_STAGE_ID) return;
    if (
      source.droppableId === destination.droppableId &&
      source.index === destination.index
    ) {
      return;
    }
    void onMove(draggableId, destination.droppableId, source.droppableId);
  };

  const totalItems = columns.reduce(
    (n, c) => n + (itemsByStage[c.id]?.length ?? 0),
    0
  );

  if (emptyState && totalItems === 0) {
    return <div className={className}>{emptyState}</div>;
  }

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <div className={cn('flex gap-3 overflow-x-auto pb-4 snap-x snap-mandatory touch-pan-x', className)}>
        {columns.map((stage) => {
          const items = itemsByStage[stage.id] || [];
          const isUnmapped = stage.id === UNMAPPED_STAGE_ID;
          return (
            <div key={stage.id} className="w-[85vw] max-w-80 flex-shrink-0 snap-start sm:w-72 md:w-80">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h3 className="font-semibold flex items-center gap-2 text-sm">
                  <span className={cn('h-2.5 w-2.5 rounded-full', stage.color)} />
                  {stage.label}
                </h3>
                <Badge variant="secondary">{items.length}</Badge>
              </div>
              <Droppable droppableId={stage.id} isDropDisabled={isUnmapped}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={cn(
                      'flex min-h-[280px] flex-col gap-2 rounded-md border bg-muted/40 p-2 transition-colors sm:min-h-[420px]',
                      snapshot.isDraggingOver && 'bg-accent/60',
                      isUnmapped && 'border-dashed opacity-90'
                    )}
                  >
                    {items.map((item, index) => (
                      <Draggable key={item.id} draggableId={item.id} index={index}>
                        {(dragProvided, dragSnapshot) => (
                          <div
                            ref={dragProvided.innerRef}
                            {...dragProvided.draggableProps}
                            className={cn(
                              'rounded-md border bg-background shadow-sm',
                              dragSnapshot.isDragging && 'ring-2 ring-primary'
                            )}
                          >
                            {/* Drag handle only — keep card body clickable (links, menus). */}
                            <div
                              {...dragProvided.dragHandleProps}
                              className="flex cursor-grab items-center justify-center border-b border-transparent px-2 py-1 text-muted-foreground active:cursor-grabbing hover:bg-muted/50"
                              aria-label="Drag to move"
                            >
                              <span className="h-1 w-8 rounded-full bg-border" />
                            </div>
                            {renderCard(item)}
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                    {columnFooter?.(stage.id, items)}
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
  const configured = new Set(
    columns.filter((c) => c.id !== UNMAPPED_STAGE_ID).map((c) => c.id)
  );
  const grouped = columns.reduce(
    (acc, col) => {
      acc[col.id] = [];
      return acc;
    },
    {} as Record<string, T[]>
  );
  if (!grouped[UNMAPPED_STAGE_ID]) {
    // Caller may not have appended Unmapped yet; still collect there if needed
  }
  for (const item of items) {
    if (configured.has(item.stage) && grouped[item.stage]) {
      grouped[item.stage].push(item);
    } else if (grouped[UNMAPPED_STAGE_ID]) {
      grouped[UNMAPPED_STAGE_ID].push(item);
    } else {
      // No unmapped column in list — skip until board merges columnsWithUnmapped
      if (!grouped[UNMAPPED_STAGE_ID]) grouped[UNMAPPED_STAGE_ID] = [];
      grouped[UNMAPPED_STAGE_ID].push(item);
    }
  }
  return grouped;
}

/** Resolve board columns (with Unmapped when needed) and grouped cards. */
export function buildBoardState<T extends PipelineBoardCard>(
  items: T[],
  baseColumns: PipelineStageDef[]
): { columns: PipelineStageDef[]; itemsByStage: Record<string, T[]> } {
  const columns = columnsWithUnmapped(baseColumns, items);
  return { columns, itemsByStage: groupByStage(items, columns) };
}
