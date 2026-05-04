<template>
  <section class="drawing-2d">
    <iframe
      ref="wasmFrameElement"
      allow="fullscreen; gamepad"
      class="drawing-2d__frame"
      :srcdoc="wasmFrameDocument"
      title="Drawing canvas"
      @load="handleFrameLoad"
    ></iframe>

    <div
      v-if="!wasmReady"
      class="drawing-2d__loading"
      role="status"
      aria-live="polite"
    >
      Loading drawing canvas...
    </div>
  </section>
</template>

<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from "vue";

import type {
  EditorHandle,
  EditorSnapshot,
} from "@/features/project-create/editor/editor-host";

type DrawingStatus = "idle" | "running" | "starting";

type WasmFrameWindow = Window &
  typeof globalThis & {
    focusWasmCanvas?: () => void;
  };

const props = defineProps<{
  flushDraft: () => Promise<void>;
  initialContent: string;
  projectId: string | null;
}>();

const emit = defineEmits<{
  editorReady: [snapshot: EditorSnapshot];
  error: [message: string];
  snapshotChange: [snapshot: EditorSnapshot];
  statusChange: [status: DrawingStatus];
}>();

const wasmFrameElement = ref<HTMLIFrameElement | null>(null);
const wasmReady = ref(false);
const content = ref(props.initialContent);
const snapshot = ref<EditorSnapshot>(buildSnapshot(props.initialContent));

const wasmFrameDocument = `
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Drawing Canvas</title>
    <style>
      html,
      body {
        width: 100%;
        height: 100%;
        margin: 0;
        overflow: hidden;
        background: #05070b;
      }

      #canvas {
        display: block;
        width: 100%;
        height: 100%;
        border: 0;
        outline: none;
        background: #05070b;
      }

      #status {
        position: fixed;
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

      body[data-ready="true"] #status:empty {
        display: none;
      }
    </style>
  </head>
  <body data-ready="false">
    <canvas id="canvas" oncontextmenu="event.preventDefault()" tabindex="0"></canvas>
    <div id="status">Loading drawing canvas...</div>

    <script type="module">
      const canvas = document.getElementById("canvas");
      const status = document.getElementById("status");

      function setStatus(text) {
        status.textContent = typeof text === "string" ? text : "";
      }

      function markReady() {
        document.body.dataset.ready = "true";
        setStatus("");
        window.dispatchEvent(new CustomEvent("cpp-web-ready"));
      }

      window.focusWasmCanvas = () => {
        canvas.focus({ preventScroll: true });
      };

      canvas.addEventListener("pointerdown", () => {
        window.focusWasmCanvas();
      });

      canvas.addEventListener(
        "webglcontextlost",
        (event) => {
          event.preventDefault();
          setStatus("WebGL context lost. Reload the drawing view.");
        },
        false,
      );

      try {
        const { default: createSimboltApp } = await import("/wasm/main.js");
        let totalDependencies = 0;

        await createSimboltApp({
          canvas,
          locateFile(path) {
            return "/wasm/" + path;
          },
          monitorRunDependencies(left) {
            totalDependencies = Math.max(totalDependencies, left);
            const done = totalDependencies - left;
            setStatus(
              left
                ? "Preparing... (" + done + "/" + totalDependencies + ")"
                : "Loading drawing canvas...",
            );
          },
          print(...args) {
            console.log(...args);
          },
          printErr(...args) {
            console.error(...args);
          },
          setStatus,
        });

        markReady();
      } catch (error) {
        console.error(error);
        document.body.dataset.ready = "error";
        setStatus("Failed to load drawing canvas.");
        window.dispatchEvent(
          new CustomEvent("cpp-web-error", {
            detail: error instanceof Error ? error.message : "Failed to load drawing canvas.",
          }),
        );
      }
    <\/script>
  </body>
</html>
`;

let readyListener: (() => void) | null = null;
let errorListener: ((event: Event) => void) | null = null;

function buildSnapshot(nextContent: string): EditorSnapshot {
  const lines = nextContent.split("\n");

  return {
    charCount: nextContent.length,
    content: nextContent,
    currentColumn: (lines[lines.length - 1]?.length ?? 0) + 1,
    currentLine: lines.length,
    lineCount: Math.max(lines.length, 1),
  };
}

function syncSnapshot(nextContent: string, shouldEmit = true) {
  content.value = nextContent;
  snapshot.value = buildSnapshot(nextContent);

  if (shouldEmit) {
    emit("snapshotChange", snapshot.value);
  }
}

function getFrameWindow(): WasmFrameWindow | null {
  return wasmFrameElement.value?.contentWindow as WasmFrameWindow | null;
}

function detachFrameListeners() {
  const frameWindow = getFrameWindow();

  if (frameWindow && readyListener) {
    frameWindow.removeEventListener("cpp-web-ready", readyListener);
  }

  if (frameWindow && errorListener) {
    frameWindow.removeEventListener("cpp-web-error", errorListener);
  }

  readyListener = null;
  errorListener = null;
}

function handleFrameLoad() {
  detachFrameListeners();
  wasmReady.value = false;

  const frameWindow = getFrameWindow();

  if (!frameWindow) {
    return;
  }

  readyListener = () => {
    wasmReady.value = true;
    emit("editorReady", snapshot.value);
    emit("statusChange", "idle");
  };

  errorListener = (event) => {
    const detail = (event as CustomEvent<string>).detail;
    emit("error", typeof detail === "string" ? detail : "Failed to load drawing canvas.");
  };

  frameWindow.addEventListener("cpp-web-ready", readyListener);
  frameWindow.addEventListener("cpp-web-error", errorListener);
}

function cleanup() {
  emit("statusChange", "idle");
}

function destroy() {
  cleanup();
  detachFrameListeners();
  wasmReady.value = false;

  if (wasmFrameElement.value) {
    wasmFrameElement.value.src = "about:blank";
  }
}

function focus() {
  getFrameWindow()?.focusWasmCanvas?.();
}

function getContent() {
  return content.value;
}

function getSnapshot() {
  return snapshot.value;
}

function insertText(text: string) {
  syncSnapshot(content.value + text);
}

function setContent(nextContent: string) {
  syncSnapshot(nextContent);
}

async function startSimulation() {
  emit("statusChange", "idle");
}

function stopSimulation() {
  emit("statusChange", "idle");
}

watch(
  () => props.initialContent,
  (nextContent) => {
    syncSnapshot(nextContent, false);
  },
);

onBeforeUnmount(() => {
  destroy();
});

defineExpose<EditorHandle & {
  cleanup: () => void;
  startSimulation: () => Promise<void>;
  stopSimulation: () => void;
}>({
  cleanup,
  destroy,
  focus,
  getContent,
  getSnapshot,
  insertText,
  setContent,
  startSimulation,
  stopSimulation,
});
</script>

<style scoped>
.drawing-2d {
  position: relative;
  display: flex;
  flex: 1 1 auto;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  border: 1px solid rgba(148, 163, 184, 0.22);
  border-radius: 1rem;
  background: #05070b;
}

.drawing-2d__frame {
  display: block;
  width: 100%;
  min-width: 0;
  height: 100%;
  min-height: 0;
  flex: 1 1 auto;
  border: 0;
  background: #05070b;
}

.drawing-2d__loading {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  background: rgba(5, 7, 11, 0.72);
  color: rgba(248, 250, 252, 0.9);
  font-size: 0.85rem;
  font-weight: 700;
  pointer-events: none;
}
</style>
