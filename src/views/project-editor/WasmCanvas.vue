<template>
  <div class="wasm-wrapper" :data-ready="isReady">
    <canvas
      id="canvas"
      ref="canvas"
      class="wasm-canvas"
      @contextmenu.prevent
      tabindex="0"
      @pointerdown="focusWasmCanvas"
      @webglcontextlost.prevent="handleContextLost"
    ></canvas>
    <div v-if="statusText" class="wasm-status">{{ statusText }}</div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";

type DrawingComponentPlacement = {
  pinPositions: Array<{
    x: number;
    y: number;
  }>;
  svg: string;
};

const emit = defineEmits<{
  ready: [];
  error: [detail: string];
}>();

const canvas = ref<HTMLCanvasElement | null>(null);
const statusText = ref("Loading drawing canvas...");
const isReady = ref(false);
let wasmModule: any = null;

function setStatus(text: string) {
  statusText.value = text;
}

function focusWasmCanvas() {
  canvas.value?.focus({ preventScroll: true });
}

function handleContextLost() {
  setStatus("WebGL context lost. Reload the drawing view.");
}

function addDrawingComponent(component: DrawingComponentPlacement) {
  const addPlacingComponentFromSvg = wasmModule?.addPlacingComponentFromSvg;

  if (typeof addPlacingComponentFromSvg !== "function") {
    return false;
  }

  try {
    const added = addPlacingComponentFromSvg(component.svg, component.pinPositions);

    if (!added) {
      return false;
    }

    focusWasmCanvas();
    return true;
  } catch (error) {
    console.error(error);
    return false;
  }
}

onMounted(async () => {
  if (!canvas.value) return;

  try {
    // @ts-ignore - dynamic import from public folder
    const modulePath = "/wasm/main.js";
    const { default: createSimboltApp } = await import(/* @vite-ignore */ modulePath);
    let totalDependencies = 0;

    wasmModule = await createSimboltApp({
      canvas: canvas.value,
      locateFile(path: string) {
        return "/wasm/" + path;
      },
      monitorRunDependencies(left: number) {
        totalDependencies = Math.max(totalDependencies, left);
        const done = totalDependencies - left;
        setStatus(
          left
            ? `Preparing... (${done}/${totalDependencies})`
            : "Loading drawing canvas..."
        );
      },
      print(...args: any[]) {
        console.log(...args);
      },
      printErr(...args: any[]) {
        console.error(...args);
      },
      setStatus,
    });

    isReady.value = true;
    setStatus("");
    emit("ready");
  } catch (error) {
    console.error(error);
    isReady.value = false;
    setStatus("Failed to load drawing canvas.");
    emit("error", error instanceof Error ? error.message : "Failed to load drawing canvas.");
  }
});

defineExpose({
  addDrawingComponent,
  focusWasmCanvas,
});
</script>

<style scoped>
.wasm-wrapper {
  width: 100%;
  height: 100%;
  position: relative;
  background: #05070b;
}

.wasm-canvas {
  display: block;
  width: 100%;
  height: 100%;
  border: 0;
  outline: none;
  background: #05070b;
}

.wasm-status {
  position: absolute;
  top: 1rem;
  right: 1rem;
  padding: 0.5rem 0.7rem;
  border: 1px solid rgba(148, 163, 184, 0.28);
  border-radius: 0.5rem;
  background: rgba(5, 7, 11, 0.78);
  color: rgba(248, 250, 252, 0.92);
  font: 600 0.8rem Inter, system-ui, sans-serif;
  pointer-events: none;
}
</style>
