import { prisma } from '@/lib/prisma';
import { publishRealtime } from '@/lib/realtime/hub';
import { REALTIME_EVENTS } from '@/lib/realtime/events';

export const PROJECT_DOC_KINDS = ['FOLDER', 'PAGE'] as const;
export type ProjectDocKind = (typeof PROJECT_DOC_KINDS)[number];

const PERSON_SELECT = { id: true, name: true, email: true, image: true } as const;

/** Tree rows — everything except the body, so the sidebar stays light. */
export const PROJECT_DOC_TREE_SELECT = {
  id: true,
  parentId: true,
  kind: true,
  title: true,
  icon: true,
  sortOrder: true,
  updatedAt: true,
} as const;

export const PROJECT_DOC_DETAIL_INCLUDE = {
  createdBy: { select: PERSON_SELECT },
  updatedBy: { select: PERSON_SELECT },
} as const;

export async function assertProjectForDocs(companyId: string, projectId: string) {
  return prisma.project.findFirst({
    where: { id: projectId, companyId },
    select: { id: true, name: true },
  });
}

export async function assertProjectDoc(
  companyId: string,
  projectId: string,
  docId: string
) {
  return prisma.projectDoc.findFirst({
    where: { id: docId, projectId, project: { companyId } },
  });
}

/** True when `candidateParentId` is `docId` itself or sits somewhere beneath it. */
export async function isSelfOrDescendant(
  projectId: string,
  docId: string,
  candidateParentId: string
) {
  const rows = await prisma.projectDoc.findMany({
    where: { projectId },
    select: { id: true, parentId: true },
  });
  const parentOf = new Map<string, string | null>(rows.map((r) => [r.id, r.parentId]));
  let cursor: string | null | undefined = candidateParentId;
  // Bounded walk: a corrupt cycle must not hang the request
  for (let i = 0; cursor && i <= rows.length; i += 1) {
    if (cursor === docId) return true;
    cursor = parentOf.get(cursor);
  }
  return false;
}

export async function nextDocSortOrder(projectId: string, parentId: string | null) {
  const max = await prisma.projectDoc.aggregate({
    where: { projectId, parentId },
    _max: { sortOrder: true },
  });
  return (max._max.sortOrder ?? -1) + 1;
}

/** Nudge other open tabs to refresh the tree / the open doc. */
export function publishProjectDocChange(params: {
  companyId: string;
  projectId: string;
  docId: string;
  action: 'created' | 'updated' | 'moved' | 'deleted';
  actorId: string;
  actorName: string;
}) {
  void publishRealtime(
    REALTIME_EVENTS.PROJECT_DOC_UPDATED,
    params.companyId,
    {
      projectId: params.projectId,
      docId: params.docId,
      action: params.action,
      actorName: params.actorName,
    },
    params.actorId
  ).catch(() => undefined);
}

/** A viewer counts as present for this long after their last heartbeat. */
export const DOC_PRESENCE_WINDOW_MS = 35_000;
