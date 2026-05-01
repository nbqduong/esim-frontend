<template>
  <section class="simulate-screen">
    <header class="simulate-screen__toolbar">
      <div class="simulate-screen__controls">
        <button
          class="simulate-screen__button simulate-screen__button--accent"
          type="button"
          :disabled="!canStartPause"
          @click="startPauseSimulation"
        >
          {{ startPauseLabel }}
        </button>
        <button
          class="simulate-screen__button"
          type="button"
          :disabled="!canStop"
          @click="stopSimulation"
        >
          Stop
        </button>
      </div>
      <div class="simulate-screen__meta">
        <span>{{ statusLabel }}</span>
        <span>{{ sourceLabel }}</span>
        <span v-if="catalogSummary">{{ catalogSummary }}</span>
      </div>
      <p v-if="errorMessage" class="simulate-screen__error" role="alert">
        {{ errorMessage }}
      </p>
    </header>

    <div class="simulate-body">
      <!-- ── Left sidebar: asset library ── -->
      <aside class="asset-sidebar" aria-label="Asset library">
        <div class="asset-sidebar__header">
          <span class="asset-sidebar__title">Assets</span>
          <span
            v-if="assetsLoading"
            class="asset-sidebar__badge asset-sidebar__badge--loading"
          >loading…</span>
          <span
            v-else
            class="asset-sidebar__badge"
          >{{ assets.length }}</span>
        </div>

        <p v-if="assetsError" class="asset-sidebar__error" role="alert">
          {{ assetsError }}
        </p>

        <ul v-else class="asset-sidebar__list" role="list">
          <li
            v-for="asset in assets"
            :key="asset.id"
            class="asset-sidebar__item"
            :class="{ 'asset-sidebar__item--spawning': spawningId === asset.id }"
            role="button"
            :aria-label="`Spawn ${asset.title}`"
            :aria-busy="spawningId === asset.id"
            tabindex="0"
            @click="handleSpawn(asset)"
            @keydown.enter="handleSpawn(asset)"
            @keydown.space.prevent="handleSpawn(asset)"
          >
            <span class="asset-sidebar__item-icon" aria-hidden="true">
              <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path
                  d="M10 2L18 6.5V13.5L10 18L2 13.5V6.5L10 2Z"
                  stroke="currentColor"
                  stroke-width="1.5"
                  stroke-linejoin="round"
                />
                <path d="M10 2V18M2 6.5L10 11L18 6.5" stroke="currentColor" stroke-width="1.2" opacity="0.5" />
              </svg>
            </span>
            <span class="asset-sidebar__item-label">{{ asset.title }}</span>
            <span
              v-if="spawningId === asset.id"
              class="asset-sidebar__item-spinner"
              aria-hidden="true"
            />
            <span
              v-else
              class="asset-sidebar__item-add"
              aria-hidden="true"
            >+</span>
          </li>
          <li v-if="!assetsLoading && assets.length === 0" class="asset-sidebar__empty">
            No assets available
          </li>
        </ul>
      </aside>

      <!-- ── 3-D viewer ── -->
      <section
        ref="viewerRef"
        class="simulate-viewer"
        aria-label="3D simulation scene"
      >
        <div v-if="catalogLoading" class="simulate-viewer__overlay">
          {{ loadingMessage }}
        </div>
        <div
          v-else-if="!viewerReady && !errorMessage"
          class="simulate-viewer__overlay"
        >
          Preparing the 3D viewer…
        </div>
        <div
          v-else-if="errorMessage"
          class="simulate-viewer__overlay"
        >
          {{ errorMessage }}
        </div>
      </section>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useRoute } from "vue-router";
import { catalogManager } from "@/features/static-models/catalogManager";
import {
  fetchPublicStaticAssets,
  type StaticAsset,
} from "@/features/static-models/api";

import { loadModelCatalogFromIndexedDB } from "@/lib/browser-data/indexBD-manager";
import {
  create3DViewer,
  type ModelCatalog,
  type ThreeDViewer,
} from "@/features/project-create/three/create3DViewer";
import { createStateLoader, type StateLoader } from "@/features/project-create/three/stateLoader";

type SimulationStatus = "error" | "idle" | "paused" | "running";


const emit = defineEmits<{
  stateChange: [
    payload: {
      canStartPause: boolean;
      canStop: boolean;
      catalogLoading: boolean;
      catalogSummary: string;
      errorMessage: string;
      loadingMessage: string;
      sourceLabel: string;
      startPauseLabel: string;
      statusLabel: string;
      simulationStatus: SimulationStatus;
      viewerReady: boolean;
    },
  ];
}>();

// ─── Viewer & simulation state ───────────────────────────────────────────────
const viewerRef = ref<HTMLElement | null>(null);
const viewerReady = ref(false);
const catalogLoading = ref(true);
const isBusy = ref(false);
const simulationStatus = ref<SimulationStatus>("idle");
const errorMessage = ref("");
const loadedCatalog = ref<ModelCatalog | null>(null);
const sourceLabel = "IndexedDB";
const route = useRoute();
const routeProjectId = computed(() => {
  const param = route.params.projectId;
  return typeof param === "string" ? param : null;
});

// ─── Asset sidebar state ──────────────────────────────────────────────────────
const assets = ref<StaticAsset[]>([]);
const assetsLoading = ref(true);
const assetsError = ref("");
const spawningId = ref<string | null>(null);

const loadingMessage = computed(
  () => `Loading model catalog from ${sourceLabel.toLowerCase()}...`,
);

const startPauseLabel = computed(() =>
  simulationStatus.value === "running" ? "Pause" : "Start",
);

const statusLabel = computed(() => {
  if (catalogLoading.value) {
    return "Loading";
  }

  switch (simulationStatus.value) {
    case "running":
      return "Running";
    case "paused":
      return "Paused";
    case "error":
      return "Error";
    default:
      return "Idle";
  }
});

const catalogSummary = computed(() => {
  const catalog = loadedCatalog.value;

  if (!catalog) {
    return "";
  }

  const objectCount = catalog.reduce(
    (total, entry) => total + entry.objects.length,
    0,
  );

  return `${catalog.length} models and ${objectCount} objects loaded from ${sourceLabel.toLowerCase()}.`;
});

const canStartPause = computed(
  () => !!stateLoader.value && viewerReady.value && !isBusy.value && !catalogLoading.value,
);

const canStop = computed(
  () =>
    !!stateLoader.value &&
    !isBusy.value &&
    !catalogLoading.value &&
    simulationStatus.value !== "idle",
);

const viewer = ref<ThreeDViewer | null>(null);
const stateLoader = ref<StateLoader | null>(null);
let destroyed = false;

function emitStateChange() {
  emit("stateChange", {
    canStartPause: canStartPause.value,
    canStop: canStop.value,
    catalogLoading: catalogLoading.value,
    catalogSummary: catalogSummary.value,
    errorMessage: errorMessage.value,
    loadingMessage: loadingMessage.value,
    sourceLabel: sourceLabel,
    simulationStatus: simulationStatus.value,
    startPauseLabel: startPauseLabel.value,
    statusLabel: statusLabel.value,
    viewerReady: viewerReady.value,
  });
}

async function startPauseSimulation(): Promise<void> {
  if (!stateLoader.value || !viewerReady.value || isBusy.value || catalogLoading.value) {
    return;
  }

  if (simulationStatus.value === "running") {
    stateLoader.value.pause();
    simulationStatus.value = "paused";
    return;
  }

  isBusy.value = true;
  errorMessage.value = "";

  try {
    await stateLoader.value.start();
    simulationStatus.value = "running";
  } catch (error) {
    console.error("Unable to start the WASM state loader", error);
    stateLoader.value.stop();
    simulationStatus.value = "error";
    errorMessage.value = "The WASM simulator could not be started.";
  } finally {
    isBusy.value = false;
  }
}

function stopSimulation(): void {
  if (
    !stateLoader.value ||
    isBusy.value ||
    catalogLoading.value ||
    simulationStatus.value === "idle"
  ) {
    return;
  }

  stateLoader.value.stop();
  simulationStatus.value = "idle";
  errorMessage.value = "";
}

// ─── Spawn handler ────────────────────────────────────────────────────────────
async function handleSpawn(asset: StaticAsset): Promise<void> {
  if (!viewer.value || !viewerReady.value || spawningId.value !== null) {
    return;
  }

  spawningId.value = asset.id;
  try {
    await viewer.value.spawnAsset(asset.url);
  } catch (error) {
    console.error("Failed to spawn asset", asset.url, error);
  } finally {
    spawningId.value = null;
  }
}

// ─── Initialization ───────────────────────────────────────────────────────────
async function fetchAssets(): Promise<void> {
  assetsLoading.value = true;
  assetsError.value = "";
  try {
    assets.value = await fetchPublicStaticAssets();
  } catch (error) {
    console.error("Failed to fetch static assets", error);
    assetsError.value = "Could not load assets from server.";
  } finally {
    assetsLoading.value = false;
  }
}

const initializeScreen = async (): Promise<void> => {
  const container = viewerRef.value;

  if (!container) {
    catalogLoading.value = false;
    return;
  }

  try {
    await catalogManager.initialize();
    const catalog = await loadModelCatalogFromIndexedDB(routeProjectId.value);

    if (destroyed) {
      return;
    }

    loadedCatalog.value = catalog;

    viewer.value = create3DViewer({
      container,
      catalog,
    });

    stateLoader.value = createStateLoader({
      catalog,
      objectManager: viewer.value.objectManager,
    });

    await viewer.value.ready;

    if (destroyed) {
      return;
    }

    viewerReady.value = true;
    simulationStatus.value = "idle";
  } catch (error) {
    console.error("Unable to initialize the simulation screen", error);
    simulationStatus.value = "error";
    errorMessage.value = "The simulation screen could not load the catalog from IndexedDB.";
  } finally {
    if (!destroyed) {
      catalogLoading.value = false;
    }
  }
};

watch(
  [
    canStartPause,
    canStop,
    catalogLoading,
    catalogSummary,
    errorMessage,
    loadingMessage,
    sourceLabel,
    startPauseLabel,
    statusLabel,
    simulationStatus,
    viewerReady,
  ],
  emitStateChange,
  { immediate: true },
);

onMounted(() => {
  void initializeScreen();
  void fetchAssets();
});

onBeforeUnmount(() => {
  destroyed = true;
  stateLoader.value?.stop();
  stateLoader.value = null;
  viewer.value?.destroy();
  viewer.value = null;
});

defineExpose({
  startPauseSimulation,
  stopSimulation,
});
</script>

<style scoped>
/* ── Layout ────────────────────────────────────────────────────────────────── */
.simulate-screen {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
}

.simulate-body {
  display: flex;
  flex: 1 1 auto;
  min-width: 0;
  min-height: 0;
  gap: 0.6rem;
}

/* ── Toolbar ───────────────────────────────────────────────────────────────── */
.simulate-screen__toolbar {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  min-height: 2.35rem;
  padding: 0 0 0.75rem;
  flex: 0 0 auto;
}

.simulate-screen__controls,
.simulate-screen__meta {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.simulate-screen__button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 1.75rem;
  padding: 0 0.65rem;
  border: 1px solid #d0d7de;
  border-radius: 0.45rem;
  background: #ffffff;
  color: #24292f;
  font-size: 0.75rem;
  font-weight: 700;
  cursor: pointer;
  transition:
    background-color 140ms ease,
    border-color 140ms ease,
    color 140ms ease;
}

.simulate-screen__button:hover:not(:disabled) {
  border-color: rgba(9, 105, 218, 0.35);
  background: rgba(9, 105, 218, 0.06);
  color: #0969da;
}

.simulate-screen__button--accent {
  border-color: rgba(9, 105, 218, 0.35);
  background: rgba(9, 105, 218, 0.1);
  color: #0969da;
}

.simulate-screen__button:disabled {
  opacity: 0.5;
  cursor: default;
}

.simulate-screen__meta {
  min-width: 0;
  overflow: hidden;
  color: #57606a;
  font-size: 0.76rem;
  font-weight: 700;
}

.simulate-screen__meta span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.simulate-screen__error {
  margin: 0;
  color: #b42318;
  font-size: 0.76rem;
  font-weight: 600;
}

/* ── Asset sidebar ─────────────────────────────────────────────────────────── */
.asset-sidebar {
  display: flex;
  flex-direction: column;
  flex: 0 0 220px;
  min-height: 0;
  border: 1px solid rgba(208, 215, 222, 0.75);
  border-radius: 0.9rem;
  background: #f9fafb;
  overflow: hidden;
}

.asset-sidebar__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.65rem 0.85rem 0.55rem;
  border-bottom: 1px solid rgba(208, 215, 222, 0.6);
  background: #ffffff;
  flex: 0 0 auto;
}

.asset-sidebar__title {
  font-size: 0.78rem;
  font-weight: 700;
  color: #24292f;
  letter-spacing: 0.02em;
  text-transform: uppercase;
}

.asset-sidebar__badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 1.4rem;
  height: 1.25rem;
  padding: 0 0.35rem;
  border-radius: 999px;
  background: rgba(9, 105, 218, 0.08);
  color: #0969da;
  font-size: 0.7rem;
  font-weight: 700;
}

.asset-sidebar__badge--loading {
  background: rgba(130, 80, 223, 0.08);
  color: #8250df;
}

.asset-sidebar__error {
  margin: 0.75rem 0.85rem;
  color: #b42318;
  font-size: 0.75rem;
}

.asset-sidebar__list {
  flex: 1 1 auto;
  overflow-y: auto;
  margin: 0;
  padding: 0.4rem 0;
  list-style: none;
  scrollbar-width: thin;
  scrollbar-color: rgba(208, 215, 222, 0.8) transparent;
}

.asset-sidebar__list::-webkit-scrollbar {
  width: 4px;
}

.asset-sidebar__list::-webkit-scrollbar-thumb {
  background: rgba(208, 215, 222, 0.8);
  border-radius: 2px;
}

.asset-sidebar__empty {
  padding: 1.5rem 0.85rem;
  color: #8c959f;
  font-size: 0.78rem;
  text-align: center;
}

.asset-sidebar__item {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  padding: 0.45rem 0.85rem;
  cursor: pointer;
  border-radius: 0.4rem;
  margin: 0 0.3rem;
  user-select: none;
  transition:
    background-color 120ms ease,
    color 120ms ease;
  color: #24292f;
  font-size: 0.8rem;
  outline: none;
}

.asset-sidebar__item:hover,
.asset-sidebar__item:focus-visible {
  background: rgba(9, 105, 218, 0.07);
  color: #0969da;
}

.asset-sidebar__item--spawning {
  pointer-events: none;
  opacity: 0.65;
}

.asset-sidebar__item-icon {
  display: flex;
  flex: 0 0 1.15rem;
  width: 1.15rem;
  height: 1.15rem;
  color: #8c959f;
}

.asset-sidebar__item:hover .asset-sidebar__item-icon,
.asset-sidebar__item:focus-visible .asset-sidebar__item-icon {
  color: #0969da;
}

.asset-sidebar__item-icon svg {
  width: 100%;
  height: 100%;
}

.asset-sidebar__item-label {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 500;
}

.asset-sidebar__item-add {
  flex: 0 0 auto;
  font-size: 1.1rem;
  font-weight: 300;
  color: #8c959f;
  line-height: 1;
  transition: color 120ms ease, transform 120ms ease;
}

.asset-sidebar__item:hover .asset-sidebar__item-add,
.asset-sidebar__item:focus-visible .asset-sidebar__item-add {
  color: #0969da;
  transform: scale(1.25);
}

/* Spinner for spawning state */
.asset-sidebar__item-spinner {
  flex: 0 0 auto;
  width: 0.85rem;
  height: 0.85rem;
  border: 2px solid rgba(9, 105, 218, 0.2);
  border-top-color: #0969da;
  border-radius: 50%;
  animation: sidebar-spin 0.7s linear infinite;
}

@keyframes sidebar-spin {
  to { transform: rotate(360deg); }
}

/* ── 3-D viewer ────────────────────────────────────────────────────────────── */
.simulate-viewer {
  position: relative;
  display: flex;
  flex: 1 1 auto;
  min-width: 0;
  min-height: 0;
  border: 1px solid rgba(208, 215, 222, 0.75);
  border-radius: 0.9rem;
  overflow: hidden;
  background: #eef2f8;
}

.simulate-viewer__overlay {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  padding: 1rem;
  background: rgba(255, 255, 255, 0.7);
  color: #57606a;
  font-size: 0.9rem;
  font-weight: 600;
  text-align: center;
  z-index: 1;
}
</style>
