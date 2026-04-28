const PROJECT_DATABASE_NAME = import.meta.env.VITE_PROJECT_DATABASE_NAME || "e-sim-projects";
const PROJECT_DATABASE_VERSION = import.meta.env.VITE_PROJECT_DATABASE_VERSION ? Number(import.meta.env.VITE_PROJECT_DATABASE_VERSION) : 1;
const PROJECT_DRAFT_STORE_NAME = import.meta.env.VITE_PROJECT_DRAFT_STORE_NAME || "project-drafts";
export const NEW_PROJECT_DRAFT_ID = import.meta.env.VITE_NEW_PROJECT_DRAFT_ID || "draft:new";

export type ProjectDraftSyncState = "dirty" | "error" | "idle" | "synced";

export interface ProjectDraftRecord {
  content: string;
  id: string;
  lastSyncedChecksum: string | null;
  lastSyncedTitle: string | null;
  localChecksum: string | null;
  projectId: string | null;
  syncState: ProjectDraftSyncState;
  title: string;
  updatedAt: number;
}

let databasePromise: Promise<IDBDatabase> | null = null;

function isIndexedDbAvailable(): boolean {
  return typeof window !== "undefined" && typeof window.indexedDB !== "undefined";
}

function waitForRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    request.addEventListener("success", () => {
      resolve(request.result);
    });
    request.addEventListener("error", () => {
      reject(request.error ?? new Error("IndexedDB request failed"));
    });
  });
}

function waitForTransaction(transaction: IDBTransaction): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    transaction.addEventListener("complete", () => {
      resolve();
    });
    transaction.addEventListener("abort", () => {
      reject(transaction.error ?? new Error("IndexedDB transaction aborted"));
    });
    transaction.addEventListener("error", () => {
      reject(transaction.error ?? new Error("IndexedDB transaction failed"));
    });
  });
}

function createDraftId(projectId: string | null): string {
  return projectId ? `project:${projectId}` : NEW_PROJECT_DRAFT_ID;
}

function normalizeDraftRecord(
  value: Partial<ProjectDraftRecord> | null | undefined,
  projectId: string | null,
): ProjectDraftRecord {
  return {
    content: value?.content ?? "",
    id: createDraftId(projectId),
    lastSyncedChecksum: value?.lastSyncedChecksum ?? null,
    lastSyncedTitle: value?.lastSyncedTitle ?? null,
    localChecksum: value?.localChecksum ?? null,
    projectId,
    syncState: value?.syncState ?? "idle",
    title: value?.title ?? "",
    updatedAt: value?.updatedAt ?? Date.now(),
  };
}

async function openProjectDatabase(): Promise<IDBDatabase> {
  if (!isIndexedDbAvailable()) {
    throw new Error("IndexedDB is not available in this environment");
  }

  if (!databasePromise) {
    databasePromise = new Promise<IDBDatabase>((resolve, reject) => {
      const openRequest = window.indexedDB.open(
        PROJECT_DATABASE_NAME,
        PROJECT_DATABASE_VERSION,
      );

      openRequest.addEventListener("upgradeneeded", () => {
        const database = openRequest.result;

        if (!database.objectStoreNames.contains(PROJECT_DRAFT_STORE_NAME)) {
          database.createObjectStore(PROJECT_DRAFT_STORE_NAME, { keyPath: "id" });
        }
      });

      openRequest.addEventListener("success", () => {
        const database = openRequest.result;
        database.addEventListener("versionchange", () => {
          database.close();
          databasePromise = null;
        });
        resolve(database);
      });

      openRequest.addEventListener("blocked", () => {
        databasePromise = null;
        reject(new Error("Opening the project draft database was blocked"));
      });

      openRequest.addEventListener("error", () => {
        databasePromise = null;
        reject(openRequest.error ?? new Error("Failed to open the project draft database"));
      });
    });
  }

  return databasePromise;
}

async function getDraftById(id: string): Promise<ProjectDraftRecord | null> {
  if (!isIndexedDbAvailable()) {
    return null;
  }

  const database = await openProjectDatabase();
  const transaction = database.transaction(PROJECT_DRAFT_STORE_NAME, "readonly");
  const store = transaction.objectStore(PROJECT_DRAFT_STORE_NAME);
  const request = store.get(id);

  const draft = (await waitForRequest(request)) as ProjectDraftRecord | undefined;
  await waitForTransaction(transaction);

  return draft ?? null;
}

export function canUseProjectDraftStorage(): boolean {
  return isIndexedDbAvailable();
}

export function getProjectDraftId(projectId: string | null): string {
  return createDraftId(projectId);
}

export function createEmptyProjectDraft(projectId: string | null): ProjectDraftRecord {
  return normalizeDraftRecord(null, projectId);
}

export async function loadProjectDraft(projectId: string | null): Promise<ProjectDraftRecord | null> {
  if (!isIndexedDbAvailable()) {
    return null;
  }

  const draft = await getDraftById(createDraftId(projectId));
  if (draft) {
    return normalizeDraftRecord(draft, projectId);
  }

  return null;
}

export async function saveProjectDraft(draft: ProjectDraftRecord): Promise<ProjectDraftRecord | null> {
  if (!isIndexedDbAvailable()) {
    return null;
  }

  const normalizedDraft = normalizeDraftRecord(draft, draft.projectId ?? null);
  normalizedDraft.id = draft.id;

  const database = await openProjectDatabase();
  const transaction = database.transaction(PROJECT_DRAFT_STORE_NAME, "readwrite");
  const store = transaction.objectStore(PROJECT_DRAFT_STORE_NAME);

  store.put(normalizedDraft);
  await waitForTransaction(transaction);

  return normalizedDraft;
}

export async function deleteProjectDraft(draftId: string): Promise<void> {
  if (!isIndexedDbAvailable()) {
    return;
  }

  const database = await openProjectDatabase();
  const transaction = database.transaction(PROJECT_DRAFT_STORE_NAME, "readwrite");
  const store = transaction.objectStore(PROJECT_DRAFT_STORE_NAME);

  store.delete(draftId);
  await waitForTransaction(transaction);
}
