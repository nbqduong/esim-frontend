<template>
  <section class="drawing-2d">
    <header class="drawing-2d__toolbar">
      <div class="drawing-2d__toolbar-group">
        <button
          class="drawing-2d__button drawing-2d__button--accent"
          type="button"
          :disabled="!canStartSimulation"
          @click="startSimulation"
        >
          Start
        </button>
        <button
          class="drawing-2d__button"
          type="button"
          :disabled="!canStopSimulation"
          @click="stopSimulation"
        >
          Stop
        </button>
      </div>
      <p v-if="simulationError" class="drawing-2d__error" role="alert">
        {{ simulationError }}
      </p>
    </header>

    <div class="drawing-2d__surface">
      <div class="drawing-2d__canvas-pane">
        <iframe
          ref="editorFrameElement"
          allow="fullscreen; gamepad"
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

      <label class="drawing-2d__source-pane" for="drawing-2d-source-editor">
        <span class="drawing-2d__source-header">Text Editor</span>
        <textarea
          id="drawing-2d-source-editor"
          ref="sourceTextareaElement"
          class="drawing-2d__source-input"
          :readonly="simulationOutput !== null"
          :value="sourceText"
          placeholder="Paste or type project JSON here..."
          spellcheck="false"
          @input="handleSourceTextareaInput"
          @click="handleSourceTextareaSelection"
          @keyup="handleSourceTextareaSelection"
          @select="handleSourceTextareaSelection"
        ></textarea>
      </label>
    </div>

    <footer class="drawing-2d__statusbar">
      <div class="drawing-2d__status-item">
        <span class="drawing-2d__status-dot" aria-hidden="true" />
        <span>{{ editorReady ? "READY" : "LOADING" }}</span>
      </div>
      <div class="drawing-2d__status-item">
        SIMULATION {{ simulationStatusLabel }}
      </div>
      <div class="drawing-2d__status-item">
        Ln {{ editorSnapshot.currentLine }}, Col {{ editorSnapshot.currentColumn }}
      </div>
      <div class="drawing-2d__status-item">
        {{ editorSnapshot.charCount }} chars
      </div>
    </footer>
  </section>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";

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
const sourceTextareaElement = ref<HTMLTextAreaElement | null>(null);
const editorReady = ref(false);
const simulationOutput = ref<string | null>(null);
const simulationStatus = ref<SimulationStatus>("idle");
const simulationError = ref("");
const editorSnapshot = ref<EditorSnapshot>(buildSnapshot(props.initialContent, props.initialContent.length));
const sourceText = ref(props.initialContent);
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

      #paste-target {
        position: fixed;
        top: 0;
        left: 0;
        width: 1px;
        height: 1px;
        padding: 0;
        border: 0;
        opacity: 0;
        resize: none;
        pointer-events: none;
      }
    </style>
  </head>
  <body>
    <div class="cpp-web-shell" data-state="loading">
      <canvas id="canvas" oncontextmenu="event.preventDefault()" tabindex="0"></canvas>
      <div id="status">Loading drawing canvas...</div>
      <textarea id="paste-target" aria-hidden="true" tabindex="-1"></textarea>
    </div>

    <script>
      const shellElement = document.querySelector(".cpp-web-shell");
      const statusElement = document.getElementById("status");
      const canvasElement = document.getElementById("canvas");
      const pasteTargetElement = document.getElementById("paste-target");

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

      function focusCanvas() {
        canvasElement.focus({ preventScroll: true });
      }

      function armPasteTarget() {
        pasteTargetElement.value = "";
        pasteTargetElement.focus({ preventScroll: true });
        pasteTargetElement.select();
      }

      canvasElement.addEventListener("pointerdown", () => {
        focusCanvas();
      });

      const cppWebBridge = {
        isReady: false,
        onContentChanged: null,
        focus() {
          focusCanvas();
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

      function emitPasteText(text) {
        if (!text) {
          return;
        }

        window.dispatchEvent(
          new CustomEvent("cpp-web-paste-text", {
            detail: {
              text,
            },
          }),
        );
      }

      function handlePaste(event) {
        const text = event.clipboardData?.getData("text/plain") ?? "";

        if (!text) {
          return;
        }

        event.preventDefault();
        emitPasteText(text);
        focusCanvas();
      }

      function handlePasteTargetInput() {
        const text = pasteTargetElement.value;

        if (!text) {
          return;
        }

        pasteTargetElement.value = "";
        emitPasteText(text);
        focusCanvas();
      }

      async function handlePasteShortcut(event) {
        if ((!event.ctrlKey && !event.metaKey) || event.key.toLowerCase() !== "v") {
          return;
        }

        armPasteTarget();

        if (typeof navigator.clipboard?.readText === "function") {
          try {
            const text = await navigator.clipboard.readText();
            if (text) {
              emitPasteText(text);
              pasteTargetElement.value = "";
              focusCanvas();
            }
          } catch (error) {
            // Firefox often blocks readText here. The focused textarea paste
            // target still catches the browser's native paste path.
          }
        }
      }

      window.addEventListener("paste", handlePaste);
      document.addEventListener("paste", handlePaste);
      canvasElement.addEventListener("paste", handlePaste);
      pasteTargetElement.addEventListener("paste", handlePaste);
      pasteTargetElement.addEventListener("input", handlePasteTargetInput);
      window.addEventListener("keydown", handlePasteShortcut);
      document.addEventListener("keydown", handlePasteShortcut);
      canvasElement.addEventListener("keydown", handlePasteShortcut);

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

let cppWebReadyListener: ((event: Event) => void) | null = null;
let cppWebPasteListener: ((event: Event) => void) | null = null;
let latestContent = props.initialContent;
let pendingContent = props.initialContent;
let projectSimulator: ProjectSimulator | null = null;
let sourceContent = props.initialContent;
let sourceCursorIndex = props.initialContent.length;
let trackedCursorIndex = props.initialContent.length;

const canStartSimulation = computed(
  () => editorReady.value && simulationStatus.value === "idle",
);

const canStopSimulation = computed(
  () => simulationStatus.value === "running" || simulationStatus.value === "starting",
);

const simulationStatusLabel = computed(() => {
  if (simulationStatus.value === "running") {
    return "RUNNING";
  }
  if (simulationStatus.value === "starting") {
    return "STARTING";
  }
  return "IDLE";
});

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

function syncSourceText(content: string) {
  sourceText.value = content;

  if (
    sourceTextareaElement.value &&
    sourceTextareaElement.value.value !== content
  ) {
    sourceTextareaElement.value.value = content;
  }
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
  syncSourceText(content);
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

function pushContentToBridge(content: string) {
  const bridge = getBridge();

  if (bridge?.isReady) {
    bridge.setContent(content);
  }
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

  emit("editorReady", editorSnapshot.value);
}

function detachFrameIntegration() {
  const frameWindow = getFrameWindow();

  if (frameWindow && cppWebReadyListener) {
    frameWindow.removeEventListener("cpp-web-ready", cppWebReadyListener);
  }

  if (frameWindow && cppWebPasteListener) {
    frameWindow.removeEventListener("cpp-web-paste-text", cppWebPasteListener);
  }

  if (frameWindow?.cppWebBridge) {
    frameWindow.cppWebBridge.onContentChanged = null;
  }

  cppWebReadyListener = null;
  cppWebPasteListener = null;
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
  cppWebPasteListener = (event) => {
    const detail = (event as CustomEvent<{ text?: unknown }>).detail;
    const text = typeof detail?.text === "string" ? detail.text : "";

    if (!text) {
      return;
    }

    applyPastedText(text);
  };

  frameWindow.addEventListener("cpp-web-ready", cppWebReadyListener);
  frameWindow.addEventListener("cpp-web-paste-text", cppWebPasteListener);

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
  simulationStatus.value = "idle";
  emit("statusChange", "idle");
}

async function startSimulation() {
  if (!canStartSimulation.value) {
    return;
  }

  simulationError.value = "";
  simulationStatus.value = "starting";
  emit("statusChange", "starting");

  try {
    pushContentToBridge(sourceContent);
    await props.flushDraft();
    const catalog = await loadModelCatalogFromDraft(props.projectId);

    destroyProjectSimulator();
    projectSimulator = createProjectSimulator(catalog, (nextOutput) => {
      showSimulationOutputInEditor(nextOutput);
    });

    await projectSimulator.start();
    simulationStatus.value = "running";
    emit("statusChange", "running");
  } catch (error) {
    destroyProjectSimulator();
    restoreSourceContentInEditor();
    simulationStatus.value = "idle";
    simulationError.value =
      error instanceof Error
        ? error.message
        : "The simulator could not start from the current IndexedDB draft.";
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
  simulationStatus.value = "idle";
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
  if (sourceTextareaElement.value) {
    sourceTextareaElement.value.focus();
    return;
  }

  getBridge()?.focus();
}

function canAcceptPastedText() {
  return editorReady.value && simulationOutput.value === null;
}

function applyPastedText(text: string) {
  if (!text || !canAcceptPastedText()) {
    return;
  }

  insertText(text);
  focus();
}

function getSourceTextareaCursorIndex() {
  const textarea = sourceTextareaElement.value;

  if (!textarea) {
    return sourceCursorIndex;
  }

  return textarea.selectionStart ?? textarea.value.length;
}

function handleSourceTextareaInput(event: Event) {
  const target = event.target;

  if (!(target instanceof HTMLTextAreaElement) || simulationOutput.value !== null) {
    return;
  }

  commitSourceContent(target.value, target.selectionStart ?? target.value.length);
  pushContentToBridge(target.value);
}

function handleSourceTextareaSelection() {
  if (simulationOutput.value !== null) {
    return;
  }

  sourceCursorIndex = getSourceTextareaCursorIndex();
  trackedCursorIndex = sourceCursorIndex;
  updateSourceSnapshot();
  emit("snapshotChange", editorSnapshot.value);
}

function getContent() {
  return sourceContent;
}

function getSnapshot() {
  return editorSnapshot.value;
}

function insertText(text: string) {
  const content = getContent();
  const nextCursorIndex = sourceCursorIndex + text.length;
  const nextContent =
    content.slice(0, sourceCursorIndex) +
    text +
    content.slice(sourceCursorIndex);

  if (simulationOutput.value !== null) {
    return;
  }

  commitSourceContent(nextContent, nextCursorIndex);
  pushContentToBridge(nextContent);

  sourceTextareaElement.value?.setSelectionRange(nextCursorIndex, nextCursorIndex);
}

function setContent(content: string) {
  sourceContent = content;
  sourceCursorIndex = content.length;
  syncSourceText(content);

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
  flex-direction: column;
  flex: 1 1 auto;
  min-height: 0;
  position: relative;
}

.drawing-2d__toolbar {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  min-height: 2.35rem;
  padding: 0 0 0.75rem;
  flex: 0 0 auto;
}

.drawing-2d__toolbar-group {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.drawing-2d__button {
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

.drawing-2d__button:hover:not(:disabled) {
  border-color: rgba(9, 105, 218, 0.35);
  background: rgba(9, 105, 218, 0.06);
  color: #0969da;
}

.drawing-2d__button--accent {
  border-color: rgba(9, 105, 218, 0.35);
  background: rgba(9, 105, 218, 0.1);
  color: #0969da;
}

.drawing-2d__button:disabled {
  opacity: 0.5;
  cursor: default;
}

.drawing-2d__error {
  margin: 0;
  color: #b42318;
  font-size: 0.76rem;
  font-weight: 600;
}

.drawing-2d__surface {
  display: grid;
  grid-template-columns: minmax(0, 1.3fr) minmax(20rem, 0.9fr);
  gap: 1rem;
  flex: 1 1 auto;
  min-height: 0;
}

.drawing-2d__canvas-pane,
.drawing-2d__source-pane {
  position: relative;
  min-width: 0;
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

.drawing-2d__canvas-pane {
  display: flex;
  min-height: 0;
}

.drawing-2d__source-pane {
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
  padding: 0.85rem;
}

.drawing-2d__source-header {
  color: #57606a;
  font-size: 0.74rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.drawing-2d__source-input {
  flex: 1 1 auto;
  min-height: 0;
  width: 100%;
  border: 1px solid rgba(148, 163, 184, 0.28);
  border-radius: 0.8rem;
  background: #0f172a;
  color: #e2e8f0;
  padding: 0.9rem 1rem;
  resize: none;
  outline: none;
  font-family: "JetBrains Mono", "Fira Code", monospace;
  font-size: 0.82rem;
  line-height: 1.55;
  white-space: pre;
  overflow: auto;
}

.drawing-2d__source-input:focus {
  border-color: rgba(56, 189, 248, 0.4);
  box-shadow: 0 0 0 0.2rem rgba(56, 189, 248, 0.12);
}

.drawing-2d__source-input:read-only {
  opacity: 0.8;
}

.drawing-2d__frame {
  flex: 1 1 auto;
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

.drawing-2d__statusbar {
  display: flex;
  align-items: center;
  gap: 1rem;
  min-height: 2rem;
  padding: 0.55rem 0 0;
  flex: 0 0 auto;
  color: #57606a;
  font-family: "JetBrains Mono", "Fira Code", monospace;
  font-size: 0.74rem;
}

.drawing-2d__status-item {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  white-space: nowrap;
}

.drawing-2d__status-dot {
  width: 0.55rem;
  height: 0.55rem;
  border-radius: 999px;
  background: #1a7f37;
  box-shadow: 0 0 0.55rem rgba(26, 127, 55, 0.3);
}

@media (max-width: 1080px) {
  .drawing-2d__surface {
    grid-template-columns: 1fr;
  }

  .drawing-2d__canvas-pane {
    min-height: 24rem;
  }

  .drawing-2d__source-pane {
    min-height: 16rem;
  }
}
</style>
