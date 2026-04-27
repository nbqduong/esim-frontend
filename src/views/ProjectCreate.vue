<template>
  <div class="project-create">
    <div class="project-create__glow project-create__glow--top" aria-hidden="true"></div>
    <div class="project-create__glow project-create__glow--bottom" aria-hidden="true"></div>

    <header class="project-create__topbar">
      <div class="project-create__view-tabs">
        <button
          class="project-create__home-button"
          type="button"
          aria-label="Go to home"
          title="Home"
          @click="navigateHome"
        >
          <span
            class="project-create__home-icon"
            aria-hidden="true"
            v-html="iconMarkup('home')"
          ></span>
        </button>

        <SystemMenu
          :save-disabled="isSaveToDriveDisabled"
          :save-label="saveButtonLabel"
          :status-label="cloudStatusLabel"
          :title="title"
          @file="handleMenuFile"
          @save="handleSaveToDrive"
          @settings="navigateSettings"
        />

        <div
          class="project-create__view-tab-list"
          role="tablist"
          aria-label="Page views"
        >
          <button
            v-for="view in workspaceViewItems"
            :key="view.id"
            class="project-create__view-tab"
            :class="{ 'project-create__view-tab--active': activeWorkspaceView === view.id }"
            type="button"
            role="tab"
            :aria-selected="activeWorkspaceView === view.id"
            :tabindex="activeWorkspaceView === view.id ? 0 : -1"
            @click="activeWorkspaceView = view.id"
          >
            {{ view.label }}
          </button>
        </div>
      </div>

      <div class="project-create__title-slot">
        <input
          id="project-create-title"
          v-model="title"
          class="project-create__title-input"
          type="text"
          placeholder="Document title"
        />
      </div>

      <div class="project-create__topbar-actions">
        <span class="project-create__cloud-note">
          {{ cloudStatusLabel }}
        </span>
        <button
          v-if="activeProjectId"
          class="project-create__delete-button"
          type="button"
          :disabled="isDeleteProjectDisabled"
          @click="handleDeleteProject"
        >
          <span
            class="project-create__save-icon"
            aria-hidden="true"
            v-html="iconMarkup('trash')"
          ></span>
          <span>{{ deleteButtonLabel }}</span>
        </button>
        <button
          class="project-create__save-button"
          type="button"
          :disabled="isSaveToDriveDisabled"
          @click="handleSaveToDrive"
        >
          <span
            class="project-create__save-icon"
            aria-hidden="true"
            v-html="iconMarkup('cloud-upload')"
          ></span>
          <span>{{ saveButtonLabel }}</span>
        </button>
      </div>
    </header>

    <div class="project-create__layout">
      <main class="project-create__workspace">
        <section class="project-create__editor-shell">
          <section class="project-create__editor-panel">
            <Drawing2D
              ref="drawing2DHandle"
              v-show="activeWorkspaceView === 'drawing'"
              :flush-draft="flushPendingDraftSave"
              :initial-content="currentDraft.content"
              :project-id="activeProjectId"
              @editor-ready="handleDrawingEditorReady"
              @snapshot-change="handleDrawingEditorSnapshotChange"
              @status-change="handleDrawingSimulationStatusChange"
            />
            <div
              v-if="activeWorkspaceView !== 'drawing' && isRouteHydrating"
              class="project-create__editor-placeholder"
            >
              Loading project draft...
            </div>
            <SimulateView
              v-else-if="activeWorkspaceView === 'simulate'"
              :key="activeWorkspaceViewKey"
              :catalog-loader="loadEmbeddedCatalog"
            />
            <PDFView
              v-else-if="activeWorkspaceView === 'pdf'"
              :key="activeWorkspaceViewKey"
              :catalog-loader="loadEmbeddedCatalog"
            />
            <CSVView
              v-else-if="activeWorkspaceView === 'csv'"
              :key="activeWorkspaceViewKey"
              :catalog-loader="loadEmbeddedCatalog"
            />
          </section>
        </section>
      </main>
    </div>

    <!-- Save status toast -->
    <transition name="toast-fade">
      <div v-if="cloudToast" class="project-create__toast project-create__toast--warn" role="alert">
        <span class="project-create__toast-icon" aria-hidden="true">!</span>
        <span>{{ cloudToast }}</span>
        <button class="project-create__toast-close" type="button" aria-label="Dismiss" @click="cloudToast = null">✕</button>
      </div>
    </transition>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";

import SystemMenu from "@/components/project/system-menu.vue";
import { loadModelCatalogFromDraft, parseModelCatalog } from "@/data/data-loader";
import {
  canUseProjectDraftStorage,
  createEmptyProjectDraft,
  deleteProjectDraft,
  getProjectDraftId,
  loadProjectDraft,
  saveProjectDraft,
  type ProjectDraftRecord,
  type ProjectDraftSyncState,
} from "@/data/project-loader";
import type {
  EditorHandle,
  EditorSnapshot,
} from "@/features/project-create/editor/editor-host";
import { buildProjectArchive, parseProjectArchive } from "@/lib/project-content";
import {
  completeProjectSaveToDrive,
  deleteProject,
  downloadProjectArchive,
  prepareProjectSaveToDrive,
  ProjectLimitError,
  RateLimitError,
  syncProject,
  uploadProjectArchive,
} from "@/lib/projects";
import type { ModelCatalog } from "@/three/create3DViewer";
import CSVView from "@/views/CSV.vue";
import Drawing2D from "@/views/Drawing2D.vue";
import PDFView from "@/views/PDF.vue";
import SimulateView from "@/views/Simulate.vue";

defineOptions({ name: "ProjectCreate" });

type WorkspaceView = "csv" | "drawing" | "pdf" | "simulate";
type CloudSaveState = "error" | "idle" | "saving" | "synced";
type DraftSaveState = "error" | "idle" | "saved" | "saving" | "unsupported";
type DrawingSimulationStatus = "idle" | "running" | "starting";

type WorkspaceViewItem = {
  id: WorkspaceView;
  label: string;
};

type Drawing2DHandle = EditorHandle & {
  cleanup: () => void;
  startSimulation: () => Promise<void>;
  stopSimulation: () => void;
};

function iconMarkup(name: string) {
  switch (name) {
    case "chevron-right":
      return `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="m9.75 6.75 5.5 5.25-5.5 5.25" />
        </svg>
      `;
    case "cloud-upload":
      return `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M7.25 18.25h9a3.5 3.5 0 0 0 .2-7 5 5 0 0 0-9.75-1.35A3.75 3.75 0 0 0 7.25 18.25Z" />
          <path d="M12 9.75v7" />
          <path d="m9.5 12.25 2.5-2.5 2.5 2.5" />
        </svg>
      `;
    case "home":
      return `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="m4.75 11.25 7.25-6.5 7.25 6.5" />
          <path d="M6.75 10.25v8a1 1 0 0 0 1 1h8.5a1 1 0 0 0 1-1v-8" />
          <path d="M10 19.25v-5.5h4v5.5" />
        </svg>
      `;
    case "trash":
      return `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M4.75 7.25h14.5" />
          <path d="M9.25 3.75h5.5" />
          <path d="M7.25 7.25v11a1 1 0 0 0 1 1h7.5a1 1 0 0 0 1-1v-11" />
          <path d="M10 10.25v5.5M14 10.25v5.5" />
        </svg>
      `;
    default:
      return "";
  }
}

const workspaceViewItems: WorkspaceViewItem[] = [
  { id: "drawing", label: "Drawing" },
  { id: "simulate", label: "Simulate" },
  { id: "pdf", label: "PDF" },
  { id: "csv", label: "CSV" },
];

const defaultSnapshot: EditorSnapshot = {
  charCount: 0,
  content: "",
  currentColumn: 1,
  currentLine: 1,
  lineCount: 1,
};

const route = useRoute();
const router = useRouter();
const routeProjectId = computed(() =>
  typeof route.params.projectId === "string" ? route.params.projectId : null,
);

const title = ref("");
const editorHandle = ref<EditorHandle | null>(null);
const editorReady = ref(false);
const editorSnapshot = ref<EditorSnapshot>(defaultSnapshot);
const activeWorkspaceView = ref<WorkspaceView>("drawing");
const drawing2DHandle = ref<Drawing2DHandle | null>(null);
const drawingSimulationStatus = ref<DrawingSimulationStatus>("idle");
const currentDraft = ref<ProjectDraftRecord>(createEmptyProjectDraft(routeProjectId.value));
const activeProjectId = computed(() => routeProjectId.value ?? currentDraft.value.projectId);
const draftStorageEnabled = canUseProjectDraftStorage();
const draftSaveState = ref<DraftSaveState>(draftStorageEnabled ? "idle" : "unsupported");
const cloudSaveState = ref<CloudSaveState>("idle");
const isDeletingProject = ref(false);
const isRouteHydrating = ref(true);
const cloudToast = ref<string | null>(null);
const activeWorkspaceViewKey = computed(
  () => `${activeWorkspaceView.value}:${currentDraft.value.id}`,
);
let cloudToastTimer: ReturnType<typeof setTimeout> | null = null;

function showCloudToast(message: string) {
  if (cloudToastTimer) {
    clearTimeout(cloudToastTimer);
  }
  cloudToast.value = message;
  cloudToastTimer = setTimeout(() => {
    cloudToast.value = null;
    cloudToastTimer = null;
  }, 5000);
}
const DRAFT_SAVE_DEBOUNCE_MS = 400;

let draftSaveTimer: ReturnType<typeof setTimeout> | null = null;
let draftSaveQueue: Promise<void> = Promise.resolve();
let isComponentDisposed = false;
let isHydratingDraft = false;
let hasSeenInitialEditorSnapshot = false;
let latestEditorContent = "";
let latestDraftSaveVersion = 0;

function getEffectiveTitle(candidate: string): string {
  const trimmed = candidate.trim();
  return trimmed || "Untitled";
}

function isBlankDraft(titleValue: string, content: string): boolean {
  return titleValue.trim().length === 0 && content.trim().length === 0;
}

function isDraftDirty(
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

function getDraftSyncState(draft: ProjectDraftRecord): ProjectDraftSyncState {
  if (!isDraftDirty(draft) && draft.projectId === null && isBlankDraft(draft.title, draft.content)) {
    return "idle";
  }

  return isDraftDirty(draft) ? "dirty" : "synced";
}

const hasPendingLocalChanges = computed(
  () => latestEditorContent !== currentDraft.value.content || title.value !== currentDraft.value.title,
);

const hasUnsyncedCloudChanges = computed(() => {
  if (hasPendingLocalChanges.value) {
    if (
      currentDraft.value.lastSyncedTitle === null &&
      currentDraft.value.lastSyncedChecksum === null
    ) {
      return !isBlankDraft(title.value, latestEditorContent);
    }
    return true;
  }

  return isDraftDirty(currentDraft.value);
});

const cloudStatusLabel = computed(() => {
  if (cloudSaveState.value === "saving") {
    return "DRIVE SAVING";
  }
  if (cloudSaveState.value === "error") {
    return "DRIVE ERROR";
  }
  if (hasUnsyncedCloudChanges.value) {
    return "LOCAL CHANGES";
  }
  if (routeProjectId.value ?? currentDraft.value.projectId) {
    return "DRIVE SYNCED";
  }
  return "LOCAL ONLY";
});

const saveButtonLabel = computed(() => {
  if (cloudSaveState.value === "saving") {
    return "Saving...";
  }
  if (cloudSaveState.value === "error") {
    return "Retry Save";
  }
  return "Save to Drive";
});

const deleteButtonLabel = computed(() => (isDeletingProject.value ? "Deleting..." : "Delete"));

const isSaveToDriveDisabled = computed(
  () =>
    !editorReady.value ||
    cloudSaveState.value === "saving" ||
    isDeletingProject.value,
);

const isDeleteProjectDisabled = computed(
  () =>
    !editorReady.value ||
    !activeProjectId.value ||
    cloudSaveState.value === "saving" ||
    isDeletingProject.value,
);

function handleDrawingSimulationStatusChange(status: DrawingSimulationStatus) {
  drawingSimulationStatus.value = status;
}

function handleDrawingEditorReady(snapshot: EditorSnapshot) {
  const handle = drawing2DHandle.value;

  if (!handle) {
    return;
  }

  editorHandle.value = handle;
  editorReady.value = true;
  editorSnapshot.value = snapshot;
  latestEditorContent = handle.getContent();
  hasSeenInitialEditorSnapshot = true;

  if (!isRouteHydrating.value) {
    handle.focus();
  }
}

function handleDrawingEditorSnapshotChange(snapshot: EditorSnapshot) {
  editorSnapshot.value = snapshot;
  latestEditorContent = snapshot.content;

  if (isHydratingDraft) {
    return;
  }

  if (!hasSeenInitialEditorSnapshot) {
    hasSeenInitialEditorSnapshot = true;
    return;
  }

  scheduleDraftSave(snapshot.content);
}

function navigateHome() {
  void router.push("/home");
}

function navigateSettings() {
  void router.push("/user-settings");
}

function handleMenuFile() {
  showCloudToast("File menu placeholder selected.");
}

async function buildPersistedDraft(
  content: string,
  titleValue: string,
): Promise<ProjectDraftRecord> {
  const archive = await buildProjectArchive(content);
  const nextDraft: ProjectDraftRecord = {
    ...currentDraft.value,
    content,
    id: getProjectDraftId(routeProjectId.value ?? currentDraft.value.projectId),
    localChecksum: archive.checksum,
    projectId: routeProjectId.value ?? currentDraft.value.projectId,
    syncState: "idle",
    title: titleValue,
    updatedAt: Date.now(),
  };
  nextDraft.syncState = getDraftSyncState(nextDraft);
  return nextDraft;
}

function enqueueDraftSave(saveVersion: number) {
  if (!draftStorageEnabled) {
    return;
  }

  draftSaveQueue = draftSaveQueue
    .catch(() => undefined)
    .then(async () => {
      const content = editorHandle.value?.getContent() ?? latestEditorContent;
      const nextDraft = await buildPersistedDraft(content, title.value);
      const savedDraft = await saveProjectDraft(nextDraft);
      currentDraft.value = savedDraft ?? nextDraft;

      if (isComponentDisposed) {
        return;
      }

      if (saveVersion === latestDraftSaveVersion) {
        draftSaveState.value = "saved";
      }
    })
    .catch((error) => {
      console.error("Failed to save the project draft", error);

      if (!isComponentDisposed && saveVersion === latestDraftSaveVersion) {
        draftSaveState.value = "error";
      }
    });
}

function scheduleDraftSave(content: string) {
  if (!draftStorageEnabled) {
    return;
  }

  latestEditorContent = content;
  latestDraftSaveVersion += 1;
  const saveVersion = latestDraftSaveVersion;

  if (draftSaveTimer) {
    clearTimeout(draftSaveTimer);
  }

  draftSaveState.value = "saving";
  draftSaveTimer = setTimeout(() => {
    draftSaveTimer = null;
    enqueueDraftSave(saveVersion);
  }, DRAFT_SAVE_DEBOUNCE_MS);
}

async function flushPendingDraftSave() {
  if (!draftStorageEnabled) {
    return;
  }

  latestEditorContent = editorHandle.value?.getContent() ?? latestEditorContent;

  if (draftSaveTimer) {
    clearTimeout(draftSaveTimer);
    draftSaveTimer = null;
    latestDraftSaveVersion += 1;
    draftSaveState.value = "saving";
    enqueueDraftSave(latestDraftSaveVersion);
  } else if (
    latestEditorContent !== currentDraft.value.content ||
    title.value !== currentDraft.value.title
  ) {
    latestDraftSaveVersion += 1;
    draftSaveState.value = "saving";
    enqueueDraftSave(latestDraftSaveVersion);
  }

  await draftSaveQueue;
}

async function loadEmbeddedCatalog(): Promise<ModelCatalog> {
  await flushPendingDraftSave();

  if (draftStorageEnabled) {
    return loadModelCatalogFromDraft(currentDraft.value.projectId);
  }

  return parseModelCatalog(editorHandle.value?.getContent() ?? latestEditorContent);
}

function handlePageHide() {
  void flushPendingDraftSave();
}

function handleBeforeUnload(event: BeforeUnloadEvent) {
  if (!hasUnsyncedCloudChanges.value) {
    return;
  }

  event.preventDefault();
  event.returnValue = "";
}

async function loadDraftForRoute(projectId: string | null): Promise<ProjectDraftRecord> {
  let draft = draftStorageEnabled
    ? await loadProjectDraft(projectId)
    : null;
  draft ??= createEmptyProjectDraft(projectId);

  if (!projectId) {
    draft.syncState = getDraftSyncState(draft);
    return draft;
  }

  const syncResponse = await syncProject(projectId, draft.localChecksum);

  if (syncResponse.needs_download && syncResponse.download) {
    const archiveBuffer = await downloadProjectArchive(syncResponse.download);
    const parsedArchive = await parseProjectArchive(archiveBuffer);
    const downloadedDraft: ProjectDraftRecord = {
      content: parsedArchive.content,
      id: getProjectDraftId(syncResponse.project.id),
      lastSyncedChecksum: syncResponse.project.content_checksum ?? parsedArchive.checksum,
      lastSyncedTitle: syncResponse.project.title,
      localChecksum: syncResponse.project.content_checksum ?? parsedArchive.checksum,
      projectId: syncResponse.project.id,
      syncState: "synced",
      title: syncResponse.project.title,
      updatedAt: Date.now(),
    };
    if (draftStorageEnabled) {
      await saveProjectDraft(downloadedDraft);
    }
    return downloadedDraft;
  }

  const wasLocallyDirty = isDraftDirty(draft);
  const syncedDraft: ProjectDraftRecord = {
    ...draft,
    id: getProjectDraftId(syncResponse.project.id),
    lastSyncedChecksum: syncResponse.project.content_checksum,
    lastSyncedTitle: syncResponse.project.title,
    projectId: syncResponse.project.id,
    title: wasLocallyDirty ? draft.title : syncResponse.project.title,
    updatedAt: Date.now(),
  };
  syncedDraft.syncState = getDraftSyncState(syncedDraft);

  if (draftStorageEnabled) {
    await saveProjectDraft(syncedDraft);
  }

  return syncedDraft;
}

async function applyDraft(draft: ProjectDraftRecord) {
  isHydratingDraft = true;
  currentDraft.value = draft;
  title.value = draft.title;
  latestEditorContent = draft.content;

  if (editorHandle.value) {
    editorHandle.value.setContent(draft.content);
    editorSnapshot.value = editorHandle.value.getSnapshot();
  }

  cloudSaveState.value = draft.syncState === "synced" ? "synced" : "idle";
  draftSaveState.value = draftStorageEnabled ? "saved" : "unsupported";
  isHydratingDraft = false;
}

async function hydrateCurrentRoute() {
  isRouteHydrating.value = true;

  try {
    const draft = await loadDraftForRoute(routeProjectId.value);
    await applyDraft(draft);
  } catch (error) {
    if (error instanceof RateLimitError) {
      showCloudToast("You're syncing too fast — please slow down and try again in a few seconds.");
    } else {
      console.error("Failed to hydrate the project draft", error);
    }
    cloudSaveState.value = "error";
    draftSaveState.value = draftStorageEnabled ? "error" : "unsupported";
  } finally {
    isRouteHydrating.value = false;
  }
}

async function handleSaveToDrive() {
  if (!editorHandle.value) {
    return;
  }

  const previousDraftId = currentDraft.value.id;
  cloudSaveState.value = "saving";

  try {
    const normalizedTitle = getEffectiveTitle(title.value);
    if (title.value.trim().length === 0) {
      title.value = normalizedTitle;
    }

    await flushPendingDraftSave();

    const content = editorHandle.value.getContent();
    latestEditorContent = content;
    const archive = await buildProjectArchive(content);
    const activeProjectId = routeProjectId.value ?? currentDraft.value.projectId ?? undefined;
    const prepareResponse = await prepareProjectSaveToDrive({
      content_checksum: archive.checksum,
      content_length: archive.contentLength,
      content_type: archive.contentType,
      description: "",
      metadata_json: {},
      project_id: activeProjectId,
      title: normalizedTitle,
    });

    if (prepareResponse.needs_upload) {
      if (!prepareResponse.upload) {
        throw new Error("The backend did not return a signed upload URL.");
      }
      await uploadProjectArchive(prepareResponse.upload, archive.archiveBlob);
    }

    const savedProject = prepareResponse.needs_upload
      ? await completeProjectSaveToDrive({
          content_checksum: archive.checksum,
          content_length: archive.contentLength,
          content_type: archive.contentType,
          description: "",
          metadata_json: {},
          project_id: prepareResponse.project_id,
          title: normalizedTitle,
        })
      : prepareResponse.project;

    if (!savedProject) {
      throw new Error("The backend did not return project metadata.");
    }

    const syncedDraft: ProjectDraftRecord = {
      content,
      id: getProjectDraftId(savedProject.id),
      lastSyncedChecksum: archive.checksum,
      lastSyncedTitle: savedProject.title,
      localChecksum: archive.checksum,
      projectId: savedProject.id,
      syncState: "synced",
      title: normalizedTitle,
      updatedAt: Date.now(),
    };

    if (draftStorageEnabled) {
      await saveProjectDraft(syncedDraft);
      if (previousDraftId !== syncedDraft.id) {
        await deleteProjectDraft(previousDraftId);
      }
    }

    currentDraft.value = syncedDraft;
    draftSaveState.value = draftStorageEnabled ? "saved" : draftSaveState.value;
    cloudSaveState.value = "synced";

    if (routeProjectId.value !== savedProject.id) {
      await router.replace({
        name: "Project Detail",
        params: {
          projectId: savedProject.id,
        },
      });
    }
  } catch (error) {
    if (error instanceof RateLimitError) {
      showCloudToast("You're saving too fast — please slow down and try again in a few seconds.");
      cloudSaveState.value = "error";
    } else if (error instanceof ProjectLimitError) {
      showCloudToast(error.message);
      cloudSaveState.value = "error";
    } else {
      console.error("Failed to save the project to Drive", error);
      cloudSaveState.value = "error";
    }
  }
}

async function handleDeleteProject() {
  const projectId = activeProjectId.value;
  if (!projectId) {
    return;
  }

  const confirmed = window.confirm("Delete this project permanently?");
  if (!confirmed) {
    return;
  }

  isDeletingProject.value = true;

  try {
    await deleteProject(projectId);
    if (draftStorageEnabled) {
      await deleteProjectDraft(getProjectDraftId(projectId));
    }
    cloudToast.value = null;
    await router.replace({ name: "Project" });
  } catch (error) {
    console.error("Failed to delete the project", error);
    showCloudToast(error instanceof Error ? error.message : "Failed to delete the project.");
  } finally {
    isDeletingProject.value = false;
  }
}

watch(title, () => {
  if (!draftStorageEnabled || isHydratingDraft) {
    return;
  }

  scheduleDraftSave(editorHandle.value?.getContent() ?? latestEditorContent);
});

watch(routeProjectId, async (newProjectId, oldProjectId) => {
  if (oldProjectId === undefined || newProjectId === oldProjectId || !editorReady.value) {
    return;
  }

  await hydrateCurrentRoute();
});

watch(activeWorkspaceView, (nextView, previousView) => {
  if (
    previousView === "drawing" &&
    nextView !== "drawing" &&
    drawingSimulationStatus.value !== "idle"
  ) {
    drawing2DHandle.value?.stopSimulation();
  }
});

onMounted(async () => {
  const initialDraft = await loadDraftForRoute(routeProjectId.value).catch((error) => {
    console.error("Failed to load the initial project draft", error);
    cloudSaveState.value = "error";
    draftSaveState.value = draftStorageEnabled ? "error" : "unsupported";
    return createEmptyProjectDraft(routeProjectId.value);
  });

  await applyDraft(initialDraft);
  window.addEventListener("beforeunload", handleBeforeUnload);
  window.addEventListener("pagehide", handlePageHide);
  editorHandle.value?.focus();
  isRouteHydrating.value = false;
});

onBeforeUnmount(() => {
  isComponentDisposed = true;
  if (cloudToastTimer) {
    clearTimeout(cloudToastTimer);
    cloudToastTimer = null;
  }
  window.removeEventListener("beforeunload", handleBeforeUnload);
  window.removeEventListener("pagehide", handlePageHide);
  drawing2DHandle.value?.cleanup();
  drawing2DHandle.value = null;
  void flushPendingDraftSave();
  editorHandle.value?.destroy();
  editorHandle.value = null;
});
</script>

<style scoped>
:global(body) {
  margin: 0;
}

.project-create {
  --project-create-border: #d0d7de;
  --project-create-border-strong: #d8dee4;
  --project-create-foreground: #24292f;
  --project-create-muted: #57606a;
  --project-create-accent: #0969da;
  --project-create-success: #1a7f37;
  --project-create-hover: #f6f8fa;
  --project-create-selected: #ddf4ff;
  display: flex;
  flex-direction: column;
  height: 100vh;
  height: 100dvh;
  overflow: hidden;
  position: relative;
  background:
    radial-gradient(circle at top left, rgba(9, 105, 218, 0.06), transparent 24%),
    radial-gradient(circle at bottom right, rgba(9, 105, 218, 0.04), transparent 28%),
    linear-gradient(180deg, #ffffff 0%, #f6f8fa 100%);
  color: var(--project-create-foreground);
}

.project-create__glow {
  position: absolute;
  inset: auto;
  border-radius: 999px;
  filter: blur(90px);
  pointer-events: none;
}

.project-create__glow--top {
  top: -10rem;
  left: 10%;
  width: 22rem;
  height: 22rem;
  background: rgba(9, 105, 218, 0.08);
}

.project-create__glow--bottom {
  right: 8%;
  bottom: -12rem;
  width: 20rem;
  height: 20rem;
  background: rgba(56, 139, 253, 0.06);
}

.project-create__topbar {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(10rem, 1fr) auto;
  gap: 1rem;
  align-items: center;
  min-height: 2.15rem;
  padding: 0.25rem 0.75rem;
  position: relative;
  z-index: 1;
  background: rgba(255, 255, 255, 0.96);
  border-bottom: 1px solid var(--project-create-border);
}

.project-create__view-tabs {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  min-width: 0;
}

.project-create__view-tab-list {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  min-width: 0;
  flex: 1 1 auto;
  overflow-x: auto;
}

.project-create__home-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 1.8rem;
  padding: 0 0.55rem;
  border: 1px solid rgba(208, 215, 222, 0.85);
  border-radius: 0.5rem;
  background: #ffffff;
  color: var(--project-create-muted);
  cursor: pointer;
  transition:
    background-color 140ms ease,
    border-color 140ms ease,
    color 140ms ease,
    box-shadow 140ms ease;
}

.project-create__home-button:hover {
  border-color: rgba(9, 105, 218, 0.28);
  background: rgba(9, 105, 218, 0.08);
  color: var(--project-create-accent);
}

.project-create__home-button:focus-visible {
  outline: 2px solid rgba(9, 105, 218, 0.28);
  outline-offset: 2px;
}

.project-create__home-icon {
  display: inline-flex;
  width: 1rem;
  height: 1rem;
  flex: 0 0 auto;
}

.project-create__home-icon :deep(svg) {
  width: 100%;
  height: 100%;
}

.project-create__view-tab {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 1.65rem;
  padding: 0 0.65rem;
  border: 1px solid rgba(208, 215, 222, 0.85);
  border-radius: 0.45rem;
  background: #ffffff;
  color: var(--project-create-muted);
  font-size: 0.78rem;
  font-weight: 700;
  white-space: nowrap;
  cursor: pointer;
  transition:
    background-color 140ms ease,
    border-color 140ms ease,
    color 140ms ease;
}

.project-create__view-tab:hover {
  border-color: rgba(9, 105, 218, 0.28);
  background: rgba(9, 105, 218, 0.06);
  color: var(--project-create-foreground);
}

.project-create__view-tab--active {
  border-color: rgba(9, 105, 218, 0.3);
  background: rgba(9, 105, 218, 0.1);
  color: var(--project-create-accent);
}

.project-create__view-tab:focus-visible {
  outline: 2px solid rgba(9, 105, 218, 0.28);
  outline-offset: 2px;
}

.project-create__title-slot {
  min-width: 0;
  display: flex;
  justify-content: center;
}

.project-create__topbar-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.75rem;
  min-width: 0;
}

.project-create__cloud-note {
  color: var(--project-create-muted);
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  white-space: nowrap;
}

.project-create__save-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  min-width: 9.5rem;
  min-height: 2.1rem;
  padding: 0 0.9rem;
  border: 1px solid rgba(9, 105, 218, 0.2);
  border-radius: 0.7rem;
  background: rgba(9, 105, 218, 0.08);
  color: var(--project-create-accent);
  font-size: 0.82rem;
  font-weight: 700;
  transition:
    background-color 160ms ease,
    border-color 160ms ease,
    color 160ms ease,
    transform 160ms ease;
}

.project-create__delete-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  min-width: 7.75rem;
  min-height: 2.1rem;
  padding: 0 0.9rem;
  border: 1px solid rgba(207, 34, 46, 0.24);
  border-radius: 0.7rem;
  background: rgba(207, 34, 46, 0.08);
  color: #b42318;
  font-size: 0.82rem;
  font-weight: 700;
  transition:
    background-color 160ms ease,
    border-color 160ms ease,
    color 160ms ease,
    transform 160ms ease;
}

.project-create__save-button:hover:not(:disabled) {
  background: rgba(9, 105, 218, 0.12);
  border-color: rgba(9, 105, 218, 0.28);
  transform: translateY(-1px);
}

.project-create__delete-button:hover:not(:disabled) {
  background: rgba(207, 34, 46, 0.12);
  border-color: rgba(207, 34, 46, 0.32);
  transform: translateY(-1px);
}

.project-create__save-button:disabled {
  opacity: 0.65;
  cursor: default;
}

.project-create__delete-button:disabled {
  opacity: 0.65;
  cursor: default;
}

.project-create__save-icon {
  display: inline-flex;
  width: 1rem;
  height: 1rem;
}

.project-create__save-icon :deep(svg) {
  width: 100%;
  height: 100%;
}

.project-create__title-input {
  width: min(28rem, 100%);
  padding: 0rem 0.9rem;
  border: 1px solid var(--project-create-border);
  border-radius: 0.75rem;
  background: #f6f8fa;
  color: var(--project-create-foreground);
  font-size: 0.9rem;
  font-weight: 400;
  text-align: center;
  outline: none;
  transition:
    border-color 160ms ease,
    box-shadow 160ms ease,
    background-color 160ms ease;
}

.project-create__title-input:focus {
  border-color: rgba(9, 105, 218, 0.42);
  box-shadow: 0 0 0 0.2rem rgba(9, 105, 218, 0.12);
}

.project-create__layout {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  overflow: hidden;
}

.project-create__workspace {
  flex: 1 1 auto;
  min-width: 0;
  min-height: 0;
  display: flex;
  background: rgba(255, 255, 255, 0.82);
}

.project-create__editor-shell {
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  min-width: 0;
  min-height: 0;
}

.project-create__editor-toolbar {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  min-height: 2.2rem;
  padding: 0 0.9rem;
  border-bottom: 1px solid rgba(208, 215, 222, 0.7);
  background: rgba(255, 255, 255, 0.76);
}

.project-create__editor-tab {
  display: inline-flex;
  align-items: center;
  min-height: 1.65rem;
  padding: 0 0.6rem;
  border: 1px solid rgba(208, 215, 222, 0.85);
  border-radius: 0.5rem 0.5rem 0 0;
  background: transparent;
  color: var(--project-create-muted);
  font-size: 0.78rem;
  font-weight: 600;
  cursor: pointer;
  transition:
    background-color 140ms ease,
    border-color 140ms ease,
    color 140ms ease;
}

.project-create__editor-tab:hover {
  background: rgba(9, 105, 218, 0.06);
  color: var(--project-create-foreground);
}

.project-create__editor-tab--active {
  border-bottom-color: transparent;
  background: #ffffff;
  color: var(--project-create-foreground);
}

.project-create__editor-tab:focus-visible {
  outline: 2px solid rgba(9, 105, 218, 0.28);
  outline-offset: 2px;
}

.project-create__editor-breadcrumbs {
  color: var(--project-create-muted);
  font-size: 0.78rem;
}

.project-create__editor-panel {
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  min-height: 0;
  position: relative;
  padding: 1rem;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.9), rgba(248, 250, 252, 0.92));
  overflow: hidden;
}

.project-create__editor-placeholder {
  display: grid;
  place-items: center;
  flex: 1 1 auto;
  min-height: 0;
  border: 1px dashed rgba(9, 105, 218, 0.2);
  border-radius: 0.9rem;
  background: rgba(255, 255, 255, 0.7);
  color: var(--project-create-muted);
  font-size: 0.9rem;
  font-weight: 600;
}

.project-create__statusbar {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.65rem 1rem;
  position: relative;
  z-index: 1;
  border-top: 1px solid var(--project-create-border);
  background: rgba(255, 255, 255, 0.96);
  color: var(--project-create-muted);
  font-family: "JetBrains Mono", "Fira Code", monospace;
  font-size: 0.74rem;
}

.project-create__status-item {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  white-space: nowrap;
}

.project-create__status-item--right {
  margin-left: auto;
}

.project-create__status-dot {
  width: 0.55rem;
  height: 0.55rem;
  border-radius: 999px;
  background: var(--project-create-success);
  box-shadow: 0 0 0.55rem rgba(26, 127, 55, 0.3);
}

@media (max-width: 767.98px) {
  .project-create__topbar {
    grid-template-columns: 1fr;
    gap: 0.75rem;
    padding-left: 0.85rem;
    padding-right: 0.85rem;
  }

  .project-create__topbar-actions {
    justify-content: space-between;
    flex-wrap: wrap;
  }

  .project-create__title-input {
    width: 100%;
  }

  .project-create__editor-panel {
    padding: 0.7rem;
  }
}

/* Toast notification */
.project-create__toast {
  position: fixed;
  bottom: 2.5rem;
  right: 1.5rem;
  z-index: 100;
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.7rem 1rem;
  border-radius: 8px;
  font-size: 0.8125rem;
  font-weight: 500;
  max-width: 24rem;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
}

.project-create__toast--warn {
  background: #fff8e6;
  border: 1px solid #f0b429;
  color: #7a4f00;
}

.project-create__toast-icon {
  flex-shrink: 0;
  font-size: 1rem;
}

.project-create__toast-close {
  flex-shrink: 0;
  margin-left: auto;
  background: none;
  border: none;
  cursor: pointer;
  color: inherit;
  opacity: 0.6;
  font-size: 0.875rem;
  padding: 0 0.1rem;
  line-height: 1;
}

.project-create__toast-close:hover {
  opacity: 1;
}

.toast-fade-enter-active,
.toast-fade-leave-active {
  transition: opacity 0.25s ease, transform 0.25s ease;
}

.toast-fade-enter-from,
.toast-fade-leave-to {
  opacity: 0;
  transform: translateY(0.5rem);
}
</style>
