<template>
  <section class="drawing-2d">
    <div class="drawing-2d__surface">
      <iframe
        ref="editorFrameElement"
        allow="fullscreen; gamepad; webgpu"
        class="drawing-2d__frame"
        :srcdoc="cppWebFrameDocument"
        title="Drawing canvas"
        @load="handleEditorFrameLoad"
      ></iframe>

      <div
        v-if="!editorReady"
        class="drawing-2d__loading"
        role="status"
        aria-live="polite"
      >
        Loading drawing canvas...
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from "vue";

import { loadModelCatalogFromDraft } from "@/data/data-loader";
import type {
  EditorHandle,
  EditorSnapshot,
} from "@/features/project-create/editor/editor-host";
import { createProjectSimulator, type ProjectSimulator } from "@/lib/project-simulator";

type SimulationStatus = "idle" | "running" | "starting";

type CppWebBridge = {
  focus: () => void;
  getContent: () => string;
  isReady: boolean;
  onContentChanged?: ((content: string, version: number) => void) | null;
  setContent: (content: string) => boolean;
};

type CppWebFrameWindow = Window & typeof globalThis & {
  cppWebBridge?: CppWebBridge;
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
  statusChange: [status: SimulationStatus];
}>();

const editorFrameElement = ref<HTMLIFrameElement | null>(null);
const editorReady = ref(false);
const simulationOutput = ref<string | null>(null);
const editorSnapshot = ref<EditorSnapshot>(buildSnapshot(props.initialContent, props.initialContent.length));
const cppWebFrameDocument = `
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta http-equiv="Content-Type" content="text/html; charset=utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>CPP Web Canvas</title>
    <style>
      :root {
        color-scheme: dark;
      }

      html,
      body {
        width: 100%;
        height: 100%;
        margin: 0;
        overflow: hidden;
        background: #07101c;
        font-family: Inter, system-ui, sans-serif;
      }

      body {
        display: block;
      }

      .cpp-web-shell {
        position: relative;
        width: 100%;
        height: 100%;
        background:
          radial-gradient(circle at top left, rgba(56, 189, 248, 0.1), transparent 24%),
          linear-gradient(180deg, #07101c 0%, #0b1626 100%);
      }

      #canvas {
        width: 100%;
        height: 100%;
        display: block;
        border: 0;
        outline: none;
        background: transparent;
      }

      #status {
        position: absolute;
        top: 1rem;
        right: 1rem;
        padding: 0.55rem 0.8rem;
        border: 1px solid rgba(148, 163, 184, 0.3);
        border-radius: 0.75rem;
        background: rgba(7, 16, 28, 0.76);
        color: rgba(226, 232, 240, 0.92);
        font-size: 0.8rem;
        font-weight: 600;
        pointer-events: none;
        transition: opacity 160ms ease;
      }

      .cpp-web-shell[data-state="ready"] #status:empty {
        opacity: 0;
      }
    </style>
  </head>
  <body>
    <div class="cpp-web-shell" data-state="loading">
      <canvas id="canvas" oncontextmenu="event.preventDefault()" tabindex="-1"></canvas>
      <div id="status">Loading drawing canvas...</div>
    </div>

    <script>
      const shellElement = document.querySelector(".cpp-web-shell");
      const statusElement = document.getElementById("status");
      const canvasElement = document.getElementById("canvas");

      function setStatus(text) {
        const nextText = typeof text === "string" ? text : "";
        shellElement.dataset.state = nextText ? "loading" : "ready";
        statusElement.textContent = nextText;
      }

      canvasElement.addEventListener(
        "webglcontextlost",
        (event) => {
          event.preventDefault();
          setStatus("WebGL context lost. Reload the drawing view.");
        },
        false,
      );

      const cppWebBridge = {
        isReady: false,
        onContentChanged: null,
        focus() {
          canvasElement.focus();
        },
        getContent() {
          if (!this.isReady || typeof Module?.UTF8ToString !== "function") {
            return "";
          }

          return Module.UTF8ToString(Module._editor_get_content());
        },
        setContent(content) {
          if (!this.isReady || typeof Module?.ccall !== "function") {
            return false;
          }

          Module.ccall("editor_set_content", null, ["string"], [content]);
          return true;
        },
      };

      window.cppWebBridge = cppWebBridge;
      window.onWasmContentChanged = (content, version) => {
        if (typeof cppWebBridge.onContentChanged === "function") {
          cppWebBridge.onContentChanged(content, version);
        }

        window.dispatchEvent(
          new CustomEvent("cpp-web-content-change", {
            detail: {
              content,
              version,
            },
          }),
        );
      };

      var Module = {
        print(...args) {
          console.log(...args);
        },
        printErr(...args) {
          console.error(...args);
        },
        canvas: canvasElement,
        monitorRunDependencies(left) {
          const totalDependencies = Math.max(this.totalDependencies || 0, left);
          this.totalDependencies = totalDependencies;
          const done = totalDependencies - left;
          setStatus(
            left
              ? "Preparing... (" + done + "/" + totalDependencies + ")"
              : "Loading drawing canvas...",
          );
        },
        onRuntimeInitialized() {
          cppWebBridge.isReady = true;
          setStatus("");
          window.dispatchEvent(new CustomEvent("cpp-web-ready"));
        },
        setStatus,
        totalDependencies: 0,
      };

      setStatus("Loading drawing canvas...");

      window.addEventListener("error", () => {
        shellElement.dataset.state = "error";
        setStatus("Failed to load drawing canvas.");
      });
    <\/script>
    <script async type="text/javascript" src="/cpp-web.js"><\/script>
  </body>
</html>
`;

let contentPollTimer: ReturnType<typeof setInterval> | null = null;
let cppWebReadyListener: ((event: Event) => void) | null = null;
let latestContent = props.initialContent;
let pendingContent = props.initialContent;
let projectSimulator: ProjectSimulator | null = null;
let sourceContent = props.initialContent;
let sourceCursorIndex = props.initialContent.length;
let trackedCursorIndex = props.initialContent.length;

function buildSnapshot(content: string, cursorIndex: number): EditorSnapshot {
  const clampedCursor = Math.min(Math.max(cursorIndex, 0), content.length);
  const lines = content.split("\n");
  const activeLines = content.slice(0, clampedCursor).split("\n");
  const currentLine = activeLines.length;
  const currentColumn = (activeLines[activeLines.length - 1]?.length ?? 0) + 1;

  return {
    charCount: content.length,
    content,
    currentColumn,
    currentLine,
    lineCount: Math.max(lines.length, 1),
  };
}

function estimateCursorIndex(previousContent: string, nextContent: string) {
  let prefixIndex = 0;

  while (
    prefixIndex < previousContent.length &&
    prefixIndex < nextContent.length &&
    previousContent[prefixIndex] === nextContent[prefixIndex]
  ) {
    prefixIndex += 1;
  }

  let previousSuffixIndex = previousContent.length;
  let nextSuffixIndex = nextContent.length;

  while (
    previousSuffixIndex > prefixIndex &&
    nextSuffixIndex > prefixIndex &&
    previousContent[previousSuffixIndex - 1] === nextContent[nextSuffixIndex - 1]
  ) {
    previousSuffixIndex -= 1;
    nextSuffixIndex -= 1;
  }

  return nextSuffixIndex;
}

function updateSourceSnapshot() {
  editorSnapshot.value = buildSnapshot(sourceContent, sourceCursorIndex);
}

function commitSourceContent(
  content: string,
  cursorIndex = trackedCursorIndex,
  emitSnapshot = true,
) {
  trackedCursorIndex = Math.min(Math.max(cursorIndex, 0), content.length);
  latestContent = content;
  pendingContent = content;
  sourceContent = content;
  sourceCursorIndex = trackedCursorIndex;
  updateSourceSnapshot();

  if (emitSnapshot) {
    emit("snapshotChange", editorSnapshot.value);
  }

  return editorSnapshot.value;
}

function commitDisplayedContent(content: string, cursorIndex = trackedCursorIndex) {
  trackedCursorIndex = Math.min(Math.max(cursorIndex, 0), content.length);
  latestContent = content;
  pendingContent = content;
}

function getFrameWindow(): CppWebFrameWindow | null {
  return editorFrameElement.value?.contentWindow as CppWebFrameWindow | null;
}

function getBridge(): CppWebBridge | null {
  return getFrameWindow()?.cppWebBridge ?? null;
}

function stopContentPolling() {
  if (contentPollTimer !== null) {
    clearInterval(contentPollTimer);
    contentPollTimer = null;
  }
}

function pushContentToBridge(content: string) {
  const bridge = getBridge();

  if (bridge?.isReady) {
    bridge.setContent(content);
  }
}

function syncContentFromBridge(force = false) {
  const bridge = getBridge();

  if (!bridge?.isReady) {
    return;
  }

  const nextContent = bridge.getContent();

  if (!force && nextContent === latestContent) {
    return;
  }

  const nextCursorIndex = force
    ? Math.min(trackedCursorIndex, nextContent.length)
    : estimateCursorIndex(latestContent, nextContent);

  if (simulationOutput.value !== null) {
    commitDisplayedContent(nextContent, nextCursorIndex);
    return;
  }

  commitSourceContent(nextContent, nextCursorIndex);
}

function startContentPolling() {
  stopContentPolling();
  contentPollTimer = setInterval(() => {
    syncContentFromBridge();
  }, 250);
}

function handleCppWebReady() {
  const bridge = getBridge();

  if (!bridge?.isReady) {
    return;
  }

  editorReady.value = true;
  pushContentToBridge(pendingContent);

  if (simulationOutput.value !== null) {
    commitDisplayedContent(pendingContent, pendingContent.length);
  } else {
    trackedCursorIndex = sourceCursorIndex;
    latestContent = sourceContent;
    pendingContent = sourceContent;
    updateSourceSnapshot();
  }

  startContentPolling();
  emit("editorReady", editorSnapshot.value);
}

function detachFrameIntegration() {
  stopContentPolling();

  const frameWindow = getFrameWindow();

  if (frameWindow && cppWebReadyListener) {
    frameWindow.removeEventListener("cpp-web-ready", cppWebReadyListener);
  }

  if (frameWindow?.cppWebBridge) {
    frameWindow.cppWebBridge.onContentChanged = null;
  }

  cppWebReadyListener = null;
}

function handleEditorFrameLoad() {
  detachFrameIntegration();
  editorReady.value = false;

  const frameWindow = getFrameWindow();

  if (!frameWindow) {
    return;
  }

  cppWebReadyListener = () => {
    handleCppWebReady();
  };

  frameWindow.addEventListener("cpp-web-ready", cppWebReadyListener);

  if (frameWindow.cppWebBridge) {
    frameWindow.cppWebBridge.onContentChanged = (content) => {
      if (content === latestContent) {
        return;
      }

      const nextCursorIndex = estimateCursorIndex(latestContent, content);

      if (simulationOutput.value !== null) {
        commitDisplayedContent(content, nextCursorIndex);
        return;
      }

      commitSourceContent(content, nextCursorIndex);
    };

    if (frameWindow.cppWebBridge.isReady) {
      handleCppWebReady();
    }
  }
}

function destroyProjectSimulator() {
  projectSimulator?.destroy();
  projectSimulator = null;
}

function restoreSourceContentInEditor() {
  if (simulationOutput.value === null && latestContent === sourceContent) {
    trackedCursorIndex = sourceCursorIndex;
    updateSourceSnapshot();
    return;
  }

  simulationOutput.value = null;
  trackedCursorIndex = sourceCursorIndex;
  commitDisplayedContent(sourceContent, sourceCursorIndex);
  pushContentToBridge(sourceContent);
  updateSourceSnapshot();
}

function showSimulationOutputInEditor(content: string) {
  simulationOutput.value = content;
  commitDisplayedContent(content, content.length);
  pushContentToBridge(content);
}

function stopSimulation() {
  projectSimulator?.stop();
  restoreSourceContentInEditor();
  emit("statusChange", "idle");
}

async function startSimulation() {
  emit("statusChange", "starting");

  try {
    await props.flushDraft();
    const catalog = await loadModelCatalogFromDraft(props.projectId);

    destroyProjectSimulator();
    projectSimulator = createProjectSimulator(catalog, (nextOutput) => {
      showSimulationOutputInEditor(nextOutput);
    });

    await projectSimulator.start();
    emit("statusChange", "running");
  } catch (error) {
    destroyProjectSimulator();
    restoreSourceContentInEditor();
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
  restoreSourceContentInEditor();
  emit("statusChange", "idle");
}

function destroy() {
  cleanup();
  detachFrameIntegration();
  editorReady.value = false;

  if (editorFrameElement.value) {
    editorFrameElement.value.src = "about:blank";
  }
}

function focus() {
  const bridge = getBridge();

  if (bridge?.isReady) {
    bridge.focus();
    return;
  }

  editorFrameElement.value?.focus();
}

function getContent() {
  return sourceContent;
}

function getSnapshot() {
  return editorSnapshot.value;
}

function insertText(text: string) {
  const content = getContent();
  const nextContent =
    content.slice(0, sourceCursorIndex) +
    text +
    content.slice(sourceCursorIndex);

  sourceCursorIndex += text.length;
  setContent(nextContent);
}

function setContent(content: string) {
  sourceContent = content;
  sourceCursorIndex = content.length;

  if (simulationOutput.value !== null) {
    updateSourceSnapshot();
    emit("snapshotChange", editorSnapshot.value);
    return;
  }

  commitSourceContent(content, content.length);
  pushContentToBridge(content);
}

watch(
  () => props.initialContent,
  (content) => {
    if (content === latestContent && content === pendingContent) {
      return;
    }

    setContent(content);
  },
  { immediate: true },
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
  display: flex;
  flex: 1 1 auto;
  min-height: 0;
  position: relative;
}

.drawing-2d__surface {
  position: relative;
  flex: 1 1 auto;
  min-height: 0;
  border: 1px solid rgba(148, 163, 184, 0.22);
  border-radius: 1rem;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.85), rgba(241, 245, 249, 0.92));
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.82),
    0 18px 40px rgba(15, 23, 42, 0.08);
  overflow: hidden;
}

.drawing-2d__frame {
  width: 100%;
  height: 100%;
  border: 0;
  display: block;
  background: #07101c;
}

.drawing-2d__loading {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  background: rgba(7, 16, 28, 0.72);
  color: #d8e1f5;
  font-size: 0.92rem;
  font-weight: 600;
  letter-spacing: 0;
  pointer-events: none;
}
</style>
