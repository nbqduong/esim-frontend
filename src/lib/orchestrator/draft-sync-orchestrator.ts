import {
  createManagedProjectDraft,
  getDraftSyncState,
  isBlankDraft,
  isDraftDirty,
  loadManagedProjectDraft,
  saveManagedProjectDraft,
} from "@/lib/browser-data/indexBD-manager";
import type {
  ProjectDraftRecord,
} from "@/lib/browser-data/indexDB-interface";
import type {
  ProjectSyncInput,
  ProjectSyncResult,
} from "@/lib/outer-data/project-manager";

// ── Cloud auto-save scheduler ───────────────────────────────────────────────

const CLOUD_AUTO_SAVE_DEBOUNCE_MS = Number(import.meta.env.VITE_CLOUD_AUTO_SAVE_DEBOUNCE_MS) || 3000;

export type CloudAutoSaveOptions = {
  allowDisposed?: boolean;
  replaceRoute?: boolean;
};

export interface CloudAutoSaveScheduler {
  /** Schedule a debounced cloud auto-save. */
  schedule(): void;
  /** Flush any pending auto-save immediately and await completion. */
  flush(opts?: CloudAutoSaveOptions): Promise<void>;
  /** Cancel timers (call on component unmount). */
  dispose(): void;
}

export interface CloudAutoSaveSchedulerDeps {
  canSchedule: () => boolean;
  getTitle: () => string;
  getContent: () => string;
  hasUnsyncedChanges: () => boolean;
  isSaving: () => boolean;
  isDisposed: () => boolean;
  saveToCloud: (opts?: { replaceRoute?: boolean }) => Promise<void>;
}

export function createCloudAutoSaveScheduler(
  deps: CloudAutoSaveSchedulerDeps,
): CloudAutoSaveScheduler {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let queue: Promise<void> = Promise.resolve();
  let latestVersion = 0;

  function enqueue(saveVersion: number, options: CloudAutoSaveOptions = {}) {
    queue = queue
      .catch(() => undefined)
      .then(async () => {
        if (
          (!options.allowDisposed && deps.isDisposed()) ||
          saveVersion !== latestVersion ||
          deps.isSaving()
        ) {
          return;
        }

        const content = deps.getContent();

        if (
          !deps.hasUnsyncedChanges() ||
          isBlankDraft(deps.getTitle(), content)
        ) {
          return;
        }

        await deps.saveToCloud({ replaceRoute: options.replaceRoute });
      });
  }

  function schedule() {
    if (!deps.canSchedule()) {
      return;
    }

    const content = deps.getContent();

    if (isBlankDraft(deps.getTitle(), content)) {
      return;
    }

    latestVersion += 1;
    const saveVersion = latestVersion;

    if (timer) {
      clearTimeout(timer);
    }

    timer = setTimeout(() => {
      timer = null;
      enqueue(saveVersion);
    }, CLOUD_AUTO_SAVE_DEBOUNCE_MS);
  }

  async function flush(options: CloudAutoSaveOptions = {}) {
    if (timer) {
      clearTimeout(timer);
      timer = null;
      latestVersion += 1;
      enqueue(latestVersion, options);
    } else if (deps.hasUnsyncedChanges() && !isBlankDraft(deps.getTitle(), deps.getContent())) {
      latestVersion += 1;
      enqueue(latestVersion, options);
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

// ── Load + sync draft from route ────────────────────────────────────────────

export interface LoadAndSyncDraftOptions {
  projectId: string | null;
  draftStorageEnabled: boolean;
  sync: (input: ProjectSyncInput) => Promise<ProjectSyncResult>;
}

export async function loadAndSyncDraft(
  opts: LoadAndSyncDraftOptions,
): Promise<ProjectDraftRecord> {
  const { projectId, draftStorageEnabled, sync } = opts;

  let draft = draftStorageEnabled
    ? await loadManagedProjectDraft(projectId)
    : null;
  draft ??= createManagedProjectDraft(projectId);

  if (!projectId) {
    draft.syncState = getDraftSyncState(draft);
    return draft;
  }

  const syncResult = await sync({
    projectId,
    localChecksum: draft.localChecksum,
  });

  if (syncResult.needsSync && syncResult.content !== null) {
    const downloadedDraft: ProjectDraftRecord = {
      content: syncResult.content,
      id: createManagedProjectDraft(syncResult.projectId).id,
      lastSyncedChecksum: syncResult.contentChecksum ?? syncResult.checksum,
      lastSyncedTitle: syncResult.title,
      localChecksum: syncResult.contentChecksum ?? syncResult.checksum,
      projectId: syncResult.projectId,
      syncState: "synced",
      title: syncResult.title,
      updatedAt: Date.now(),
    };
    if (draftStorageEnabled) {
      return saveManagedProjectDraft(downloadedDraft);
    }
    return downloadedDraft;
  }

  const wasLocallyDirty = isDraftDirty(draft);
  const syncedDraft: ProjectDraftRecord = {
    ...draft,
    id: createManagedProjectDraft(syncResult.projectId).id,
    lastSyncedChecksum: syncResult.contentChecksum,
    lastSyncedTitle: syncResult.title,
    projectId: syncResult.projectId,
    title: wasLocallyDirty ? draft.title : syncResult.title,
    updatedAt: Date.now(),
  };
  syncedDraft.syncState = getDraftSyncState(syncedDraft);

  if (draftStorageEnabled) {
    return saveManagedProjectDraft(syncedDraft);
  }

  return syncedDraft;
}
