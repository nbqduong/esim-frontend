import { parseModelCatalog } from "@/lib/browser-data/indexDB-data-validator";
import {
  canUseProjectDraftStorage,
  createEmptyProjectDraft,
  deleteProjectDraft,
  getProjectDraftId,
  loadProjectDraft,
  saveProjectDraft,
  type ProjectDraftRecord,
  type ProjectDraftSyncState,
} from "@/lib/browser-data/indexDB-interface";
import { buildProjectArchive } from "@/lib/outer-data/project-content";

// ── Pure draft helpers ──────────────────────────────────────────────────────

export function getEffectiveTitle(candidate: string): string {
  const trimmed = candidate.trim();
  return trimmed || "Untitled";
}

export function isBlankDraft(titleValue: string, content: string): boolean {
  return titleValue.trim().length === 0 && content.trim().length === 0;
}

export function isDraftDirty(
  draft: Pick<
    ProjectDraftRecord,
    "content" | "lastSyncedChecksum" | "lastSyncedTitle" | "localChecksum" | "title"
  >,
): boolean {
  if (draft.lastSyncedTitle === null && draft.lastSyncedChecksum === null) {
    return !isBlankDraft(draft.title, draft.content);
  }

  if (draft.lastSyncedChecksum === null) {
    return getEffectiveTitle(draft.title) !== (draft.lastSyncedTitle ?? "") || draft.content.length > 0;
  }

  return (
    draft.localChecksum !== draft.lastSyncedChecksum ||
    getEffectiveTitle(draft.title) !== (draft.lastSyncedTitle ?? "")
  );
}

export function getDraftSyncState(draft: ProjectDraftRecord): ProjectDraftSyncState {
  if (!isDraftDirty(draft) && draft.projectId === null && isBlankDraft(draft.title, draft.content)) {
    return "idle";
  }

  return isDraftDirty(draft) ? "dirty" : "synced";
}

// ── Managed draft CRUD ──────────────────────────────────────────────────────

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

// ── Build a persistable draft ───────────────────────────────────────────────

export async function buildManagedDraft(
  baseDraft: ProjectDraftRecord,
  content: string,
  titleValue: string,
): Promise<ProjectDraftRecord> {
  const archive = await buildProjectArchive(content);
  const nextDraft: ProjectDraftRecord = {
    ...baseDraft,
    content,
    id: baseDraft.id,
    localChecksum: archive.checksum,
    projectId: baseDraft.projectId,
    syncState: "idle",
    title: titleValue,
    updatedAt: Date.now(),
  };
  nextDraft.syncState = getDraftSyncState(nextDraft);
  return nextDraft;
}

// ── Draft save scheduler ────────────────────────────────────────────────────

const DRAFT_SAVE_DEBOUNCE_MS = 400;

export type DraftSaveState = "error" | "idle" | "saved" | "saving" | "unsupported";

export interface DraftSaveScheduler {
  /** Debounced save — resets the timer on each call. */
  schedule(content: string): void;
  /** Flush any pending save immediately and await completion. */
  flush(): Promise<void>;
  /** Cancel timers (call on component unmount). */
  dispose(): void;
}

export interface DraftSaveSchedulerDeps {
  enabled: boolean;
  getContent: () => string;
  getTitle: () => string;
  getCurrentDraft: () => ProjectDraftRecord;
  onDraftSaved: (draft: ProjectDraftRecord) => void;
  onStateChange: (state: DraftSaveState) => void;
  isDisposed: () => boolean;
}

export function createDraftSaveScheduler(deps: DraftSaveSchedulerDeps): DraftSaveScheduler {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let queue: Promise<void> = Promise.resolve();
  let latestVersion = 0;
  let latestContent = "";

  function enqueue(saveVersion: number) {
    if (!deps.enabled) {
      return;
    }

    queue = queue
      .catch(() => undefined)
      .then(async () => {
        const content = deps.getContent();
        const nextDraft = await buildManagedDraft(deps.getCurrentDraft(), content, deps.getTitle());
        const savedDraft = await saveManagedProjectDraft(nextDraft);

        if (deps.isDisposed()) {
          return;
        }

        deps.onDraftSaved(savedDraft);

        if (saveVersion === latestVersion) {
          deps.onStateChange("saved");
        }
      })
      .catch((error) => {
        console.error("Failed to save the project draft", error);

        if (!deps.isDisposed() && saveVersion === latestVersion) {
          deps.onStateChange("error");
        }
      });
  }

  function schedule(content: string) {
    if (!deps.enabled) {
      return;
    }

    latestContent = content;
    latestVersion += 1;
    const saveVersion = latestVersion;

    if (timer) {
      clearTimeout(timer);
    }

    deps.onStateChange("saving");
    timer = setTimeout(() => {
      timer = null;
      enqueue(saveVersion);
    }, DRAFT_SAVE_DEBOUNCE_MS);
  }

  async function flush() {
    if (!deps.enabled) {
      return;
    }

    // Ensure we read the very latest content.
    latestContent = deps.getContent();

    const currentDraft = deps.getCurrentDraft();
    if (timer) {
      clearTimeout(timer);
      timer = null;
      latestVersion += 1;
      deps.onStateChange("saving");
      enqueue(latestVersion);
    } else if (
      latestContent !== currentDraft.content ||
      deps.getTitle() !== currentDraft.title
    ) {
      latestVersion += 1;
      deps.onStateChange("saving");
      enqueue(latestVersion);
    }

    await queue;
  }

  function dispose() {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  }

  return { schedule, flush, dispose };
}

// ── Model catalog (existing) ────────────────────────────────────────────────

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
