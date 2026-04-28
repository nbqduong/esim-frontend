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
        Preparing the 3D viewer...
      </div>
      <div
        v-else-if="errorMessage"
        class="simulate-viewer__overlay"
      >
        {{ errorMessage }}
      </div>
    </section>
  </section>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useRoute } from "vue-router";

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

const initializeScreen = async (): Promise<void> => {
  const container = viewerRef.value;

  if (!container) {
    catalogLoading.value = false;
    return;
  }

  try {
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
.simulate-screen {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
}

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
