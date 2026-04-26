<template>
  <section class="drawing-2d">
    <slot :is-showing-simulation="simulationOutput !== null"></slot>
    <textarea
      v-if="simulationOutput !== null"
      class="drawing-2d__simulation-output"
      :value="simulationOutput"
      readonly
      spellcheck="false"
    ></textarea>
  </section>
</template>

<script setup lang="ts">
import { ref } from "vue";

import { loadModelCatalogFromDraft } from "@/data/data-loader";
import { createProjectSimulator, type ProjectSimulator } from "@/lib/project-simulator";

type SimulationStatus = "idle" | "running" | "starting";

const props = defineProps<{
  flushDraft: () => Promise<void>;
  projectId: string | null;
}>();

const emit = defineEmits<{
  error: [message: string];
  statusChange: [status: SimulationStatus];
}>();

const simulationOutput = ref<string | null>(null);
let projectSimulator: ProjectSimulator | null = null;

function destroyProjectSimulator() {
  projectSimulator?.destroy();
  projectSimulator = null;
}

function stopSimulation() {
  projectSimulator?.stop();
  simulationOutput.value = null;
  emit("statusChange", "idle");
}

async function startSimulation() {
  emit("statusChange", "starting");

  try {
    await props.flushDraft();
    const catalog = await loadModelCatalogFromDraft(props.projectId);

    destroyProjectSimulator();
    projectSimulator = createProjectSimulator(catalog, (nextOutput) => {
      simulationOutput.value = nextOutput;
    });

    await projectSimulator.start();
    emit("statusChange", "running");
  } catch (error) {
    destroyProjectSimulator();
    simulationOutput.value = null;
    emit("statusChange", "idle");
    emit(
      "error",
      error instanceof Error
        ? error.message
        : "The simulator could not start from the current IndexedDB draft.",
    );
  }
}

function cleanup() {
  destroyProjectSimulator();
  simulationOutput.value = null;
  emit("statusChange", "idle");
}

defineExpose({
  cleanup,
  startSimulation,
  stopSimulation,
});
</script>

<style scoped>
.drawing-2d {
  display: flex;
  flex: 1 1 auto;
  min-height: 0;
  position: relative;
}

.drawing-2d__simulation-output {
  position: absolute;
  inset: 0;
  resize: none;
  border: 1px solid rgba(208, 215, 222, 0.9);
  border-radius: 0.9rem;
  padding: 1rem 1.05rem;
  background: #0f172a;
  color: #d8e1f5;
  font: 500 0.84rem/1.55 "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
  outline: none;
  white-space: pre;
}
</style>
