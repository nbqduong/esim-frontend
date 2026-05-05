<template>
  <section class="drawing-2d">
    <aside class="drawing-2d__sidebar" aria-label="Component library">
      <div class="drawing-2d__sidebar-header">
        <span class="drawing-2d__sidebar-title">Components</span>
        <span class="drawing-2d__sidebar-badge">{{ componentSymbols.length }}</span>
      </div>

      <ul class="drawing-2d__component-list" role="list">
        <li
          v-for="symbol in componentSymbols"
          :key="symbol.id"
          class="drawing-2d__component-item"
          :class="{ 'drawing-2d__component-item--active': placingSymbolId === symbol.id }"
          role="button"
          :aria-label="`Add ${symbol.title}`"
          :aria-disabled="!wasmReady"
          tabindex="0"
          @click="addComponent(symbol)"
          @keydown.enter="addComponent(symbol)"
          @keydown.space.prevent="addComponent(symbol)"
        >
          <span class="drawing-2d__component-preview" aria-hidden="true">
            <img :src="symbol.previewUrl" :alt="symbol.title" />
          </span>
          <span class="drawing-2d__component-copy">
            <span class="drawing-2d__component-label">{{ symbol.title }}</span>
            <span class="drawing-2d__component-description">{{ symbol.description }}</span>
          </span>
          <span class="drawing-2d__component-add" aria-hidden="true">+</span>
        </li>
      </ul>
    </aside>

    <section class="drawing-2d__canvas-shell" aria-label="Drawing canvas">
      <WasmCanvas
        ref="wasmCanvasRef"
        class="drawing-2d__frame"
        @ready="handleWasmReady"
        @error="handleWasmError"
      />
    </section>
  </section>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from "vue";
import WasmCanvas from "./WasmCanvas.vue";

import {
  fetch2DComponentCatalog,
  load2DComponentPlacement,
  type Editor2DComponentCatalogItem,
  type Editor2DComponentId,
} from "@/features/project-create/editor/editor-loader";
import type {
  EditorHandle,
  EditorSnapshot,
} from "@/features/project-create/editor/editor-host";

type DrawingStatus = "idle" | "running" | "starting";

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

const wasmCanvasRef = ref<InstanceType<typeof WasmCanvas> | null>(null);
const wasmReady = ref(false);
const placingSymbolId = ref<Editor2DComponentId | null>(null);
const content = ref(props.initialContent);
const snapshot = ref<EditorSnapshot>(buildSnapshot(props.initialContent));
const componentSymbols = ref<Editor2DComponentCatalogItem[]>([]);

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

function handleWasmReady() {
  wasmReady.value = true;
  emit("editorReady", snapshot.value);
  emit("statusChange", "idle");
}

function handleWasmError(detail: string) {
  emit("error", detail);
}

async function addComponent(symbol: Editor2DComponentCatalogItem) {
  if (!wasmReady.value) {
    return;
  }

  let componentPlacement;

  try {
    componentPlacement = await load2DComponentPlacement(symbol);
  } catch (error) {
    emit(
      "error",
      error instanceof Error
        ? error.message
        : `Failed to load the ${symbol.title} drawing asset.`,
    );
    return;
  }

  const added = wasmCanvasRef.value?.addDrawingComponent?.(componentPlacement) ?? false;

  if (!added) {
    emit("error", `The ${symbol.title} symbol is not available in the current wasm build.`);
    return;
  }

  placingSymbolId.value = symbol.id;
  window.setTimeout(() => {
    if (placingSymbolId.value === symbol.id) {
      placingSymbolId.value = null;
    }
  }, 350);
}

function cleanup() {
  emit("statusChange", "idle");
}

function destroy() {
  cleanup();
  wasmReady.value = false;
}

function focus() {
  wasmCanvasRef.value?.focusWasmCanvas?.();
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

onMounted(async () => {
  try {
    componentSymbols.value = await fetch2DComponentCatalog();
  } catch (error) {
    emit(
      "error",
      error instanceof Error ? error.message : "Failed to load the 2D component catalog.",
    );
  }
});

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
  gap: 0.6rem;
}

.drawing-2d__sidebar {
  display: flex;
  flex: 0 0 220px;
  flex-direction: column;
  min-height: 0;
  border: 1px solid rgba(208, 215, 222, 0.75);
  border-radius: 0.9rem;
  background: #f9fafb;
  overflow: hidden;
}

.drawing-2d__sidebar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex: 0 0 auto;
  padding: 0.65rem 0.85rem 0.55rem;
  border-bottom: 1px solid rgba(208, 215, 222, 0.6);
  background: #ffffff;
}

.drawing-2d__sidebar-title {
  color: #24292f;
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.02em;
  text-transform: uppercase;
}

.drawing-2d__sidebar-badge {
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

.drawing-2d__component-list {
  flex: 1 1 auto;
  min-height: 0;
  margin: 0;
  padding: 0.45rem 0;
  overflow-y: auto;
  list-style: none;
  scrollbar-width: thin;
  scrollbar-color: rgba(208, 215, 222, 0.8) transparent;
}

.drawing-2d__component-list::-webkit-scrollbar {
  width: 4px;
}

.drawing-2d__component-list::-webkit-scrollbar-thumb {
  background: rgba(208, 215, 222, 0.8);
  border-radius: 2px;
}

.drawing-2d__component-item {
  display: grid;
  grid-template-columns: 3.1rem minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.65rem;
  margin: 0 0.3rem;
  padding: 0.55rem;
  border-radius: 0.45rem;
  color: #24292f;
  cursor: pointer;
  outline: none;
  user-select: none;
  transition:
    background-color 120ms ease,
    color 120ms ease,
    opacity 120ms ease;
}

.drawing-2d__component-item[aria-disabled="true"] {
  cursor: default;
  opacity: 0.55;
}

.drawing-2d__component-item:hover:not([aria-disabled="true"]),
.drawing-2d__component-item:focus-visible:not([aria-disabled="true"]),
.drawing-2d__component-item--active {
  background: rgba(9, 105, 218, 0.07);
  color: #0969da;
}

.drawing-2d__component-preview {
  display: grid;
  place-items: center;
  width: 3.1rem;
  height: 2.1rem;
  color: currentColor;
}

.drawing-2d__component-preview img {
  display: block;
  width: 100%;
  height: 100%;
}

.drawing-2d__component-copy {
  display: grid;
  min-width: 0;
  gap: 0.12rem;
}

.drawing-2d__component-label,
.drawing-2d__component-description {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.drawing-2d__component-label {
  font-size: 0.8rem;
  font-weight: 700;
}

.drawing-2d__component-description {
  color: #57606a;
  font-size: 0.7rem;
  font-weight: 600;
}

.drawing-2d__component-add {
  color: #8c959f;
  font-size: 1.1rem;
  font-weight: 300;
  line-height: 1;
  transition:
    color 120ms ease,
    transform 120ms ease;
}

.drawing-2d__component-item:hover:not([aria-disabled="true"]) .drawing-2d__component-add,
.drawing-2d__component-item:focus-visible:not([aria-disabled="true"]) .drawing-2d__component-add {
  color: #0969da;
  transform: scale(1.25);
}

.drawing-2d__canvas-shell {
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
