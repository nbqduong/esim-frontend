import { parseModelCatalog } from "@/lib/browser-data/indexDB-data-validator";
import {
  canUseProjectDraftStorage,
  createEmptyProjectDraft,
  deleteProjectDraft,
  getProjectDraftId,
  loadProjectDraft,
  saveProjectDraft,
  type ProjectDraftRecord,
} from "@/lib/browser-data/indexDB-interface";

export function canManageProjectDrafts(): boolean {
  return canUseProjectDraftStorage();
}

export function createManagedProjectDraft(projectId: string | null): ProjectDraftRecord {
  return createEmptyProjectDraft(projectId);
}

export async function loadManagedProjectDraft(
  projectId: string | null,
): Promise<ProjectDraftRecord | null> {
  return loadProjectDraft(projectId);
}

export async function saveManagedProjectDraft(
  draft: ProjectDraftRecord,
): Promise<ProjectDraftRecord> {
  const savedDraft = await saveProjectDraft({
    ...draft,
    id: getProjectDraftId(draft.projectId ?? null),
  });

  return savedDraft ?? {
    ...draft,
    id: getProjectDraftId(draft.projectId ?? null),
  };
}

export async function replaceManagedProjectDraft(
  previousDraftId: string,
  draft: ProjectDraftRecord,
): Promise<ProjectDraftRecord> {
  const savedDraft = await saveManagedProjectDraft(draft);

  if (previousDraftId !== savedDraft.id) {
    await deleteProjectDraft(previousDraftId);
  }

  return savedDraft;
}

export async function deleteManagedProjectDraftByProjectId(
  projectId: string | null,
): Promise<void> {
  await deleteProjectDraft(getProjectDraftId(projectId));
}

export async function loadModelCatalogFromIndexedDB(projectId: string | null = null) {
  const draft = await loadManagedProjectDraft(projectId);
  console.log("[modelCatalogDatabase] Draft loaded from IndexedDB:", {
    requestedId: projectId,
    exists: !!draft,
    contentLength: draft?.content?.length ?? 0,
    projectId: draft?.projectId
  });

  if (draft && draft.content.trim().length > 0) {
    return parseModelCatalog(draft.content);
  }

  return [];
}
