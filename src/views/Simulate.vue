<template>
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
  </section>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";

import { loadModelCatalogFromIndexedDB } from "@/data/modelCatalogDatabase";
import {
  create3DViewer,
  type ModelCatalog,
  type ThreeDViewer,
} from "@/three/create3DViewer";
import { createStateLoader, type StateLoader } from "@/three/stateLoader";

type SimulationStatus = "error" | "idle" | "paused" | "running";

const props = defineProps<{
  catalogLoader?: () => Promise<ModelCatalog>;
}>();

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
const sourceLabel = computed(() =>
  props.catalogLoader ? "Current draft" : "IndexedDB",
);
const loadingMessage = computed(
  () => `Loading model catalog from ${sourceLabel.value.toLowerCase()}...`,
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

  return `${catalog.length} models and ${objectCount} objects loaded from ${sourceLabel.value.toLowerCase()}.`;
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
    sourceLabel: sourceLabel.value,
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
    const catalog = props.catalogLoader
      ? await props.catalogLoader()
      : await loadModelCatalogFromIndexedDB();

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
    errorMessage.value = props.catalogLoader
      ? "The simulation screen could not load the current project draft."
      : "The simulation screen could not load the catalog from IndexedDB.";
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
