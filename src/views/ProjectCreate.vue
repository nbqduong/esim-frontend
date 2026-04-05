<template>
  <div class="project-create">
    <div class="project-create__glow project-create__glow--top" aria-hidden="true"></div>
    <div class="project-create__glow project-create__glow--bottom" aria-hidden="true"></div>

    <header class="project-create__topbar">
      <div class="project-create__brand-group">
        <div class="project-create__brand">E-SIM</div>
        <RouterLink class="project-create__back-link" to="/project">
          Projects
        </RouterLink>
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
    </header>

    <div class="project-create__layout">
      <aside class="project-create__side-shell">
        <nav class="project-create__activitybar" aria-label="Workbench">
          <div class="project-create__activity-group">
            <button
              v-for="item in activityItems"
              :key="item.id"
              class="project-create__activity-button"
              :class="{ 'project-create__activity-button--active': selectedActivity === item.id }"
              type="button"
              :aria-label="item.label"
              :title="item.label"
              @click="selectedActivity = item.id"
            >
              <span class="project-create__activity-icon" v-html="item.icon"></span>
            </button>
          </div>

          <div class="project-create__activity-group project-create__activity-group--bottom">
            <button
              v-for="item in activityFooterItems"
              :key="item.id"
              class="project-create__activity-button"
              type="button"
              :aria-label="item.label"
              :title="item.label"
            >
              <span class="project-create__activity-icon" v-html="item.icon"></span>
            </button>
          </div>
        </nav>

        <section class="project-create__sidebar" aria-label="Explorer">
          <div class="project-create__sidebar-header">
            <span class="project-create__sidebar-title">Explorer</span>
            <button class="project-create__sidebar-action" type="button" aria-label="More actions">
              <span class="project-create__sidebar-action-dot"></span>
              <span class="project-create__sidebar-action-dot"></span>
              <span class="project-create__sidebar-action-dot"></span>
            </button>
          </div>

          <div class="project-create__sidebar-section">
            <div class="project-create__sidebar-section-heading">
              <span class="project-create__tree-caret project-create__tree-caret--open">⌄</span>
              <span class="project-create__sidebar-section-label">Tool place</span>
            </div>
          </div>

          <div class="project-create__sidebar-footer">
            <button class="project-create__sidebar-fold" type="button">
              <span class="project-create__tree-caret project-create__tree-caret--closed">›</span>
              <span>Outline</span>
            </button>
            <button class="project-create__sidebar-fold" type="button">
              <span class="project-create__tree-caret project-create__tree-caret--closed">›</span>
              <span>Timeline</span>
            </button>
          </div>
        </section>
      </aside>

      <main class="project-create__workspace">
        <section class="project-create__editor-shell">
          <div class="project-create__editor-toolbar">
            <div class="project-create__editor-tab">Page view</div>
          </div>

          <section class="project-create__editor-panel">
            <div ref="editorHostElement" class="project-create__editor-host"></div>
          </section>
        </section>
      </main>
    </div>

    <footer class="project-create__statusbar">
      <div class="project-create__status-item">
        <span class="project-create__status-dot" aria-hidden="true" />
        <span>{{ editorReady ? "READY" : "LOADING" }}</span>
      </div>
      <div class="project-create__status-item">
        Ln {{ editorSnapshot.currentLine }}, Col {{ editorSnapshot.currentColumn }}
      </div>
      <div class="project-create__status-item">
        {{ editorSnapshot.charCount }} chars
      </div>
      <div class="project-create__status-item">UTF-8</div>
      <div class="project-create__status-item project-create__status-item--right">
        DOM EDITOR HOST V1
      </div>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from "vue";

import type {
  EditorHandle,
  EditorSnapshot,
} from "@/features/project-create/editor/editor-host";
import { mountEditor } from "@/features/project-create/editor/editor-host";

defineOptions({ name: "ProjectCreate" });

type ActivityItem = {
  icon: string;
  id: string;
  label: string;
};

function iconMarkup(name: string) {
  switch (name) {
    case "explorer":
      return `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M4.75 5.75h8.5l2 2H19.25a1 1 0 0 1 1 1v9.5a1 1 0 0 1-1 1H4.75a1 1 0 0 1-1-1V6.75a1 1 0 0 1 1-1Z" />
          <path d="M8 5.75v13.5" />
        </svg>
      `;
    case "search":
      return `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <circle cx="10.5" cy="10.5" r="5.5" />
          <path d="m15 15 4.25 4.25" />
        </svg>
      `;
    case "source-control":
      return `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <circle cx="7" cy="5.5" r="2" />
          <circle cx="17" cy="9.5" r="2" />
          <circle cx="7" cy="18.5" r="2" />
          <path d="M9 6.5h2.5a3 3 0 0 1 3 3v4.5" />
          <path d="M9 17.5h2.5a3 3 0 0 0 3-3V11" />
        </svg>
      `;
    case "run":
      return `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M7 5.75v12.5l10-6.25-10-6.25Z" />
          <path d="M5 19.25h14" />
        </svg>
      `;
    case "extensions":
      return `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M11.5 3.75H6.75a1 1 0 0 0-1 1V9.5" />
          <path d="M12.5 20.25h4.75a1 1 0 0 0 1-1V14.5" />
          <path d="M9.75 12 5.75 8l4-4 4 4-4 4Z" />
          <path d="M14.25 20l-4-4 4-4 4 4-4 4Z" />
        </svg>
      `;
    case "account":
      return `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <circle cx="12" cy="8" r="3.25" />
          <path d="M5.5 19.25a6.5 6.5 0 0 1 13 0" />
        </svg>
      `;
    case "settings":
      return `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="2.5" />
          <path d="M12 4.5v1.75M12 17.75V19.5M19.5 12h-1.75M6.25 12H4.5M17.3 6.7l-1.2 1.2M7.9 16.1l-1.2 1.2M17.3 17.3l-1.2-1.2M7.9 7.9 6.7 6.7" />
        </svg>
      `;
    case "folder":
      return `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M3.75 7.25h6l1.5 1.5h8a1 1 0 0 1 1 1v7.5a1 1 0 0 1-1 1H4.75a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1Z" />
        </svg>
      `;
    case "folder-open":
      return `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M3.75 7.25h6l1.5 1.5h8a1 1 0 0 1 .95 1.3l-1.8 6a1 1 0 0 1-.95.7H5.2a1 1 0 0 1-.96-.74l-1.44-6a1 1 0 0 1 .95-1.26Z" />
        </svg>
      `;
    case "file":
      return `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M7.75 4.5h6.2l3.3 3.3v10.45a1 1 0 0 1-1 1H7.75a1 1 0 0 1-1-1v-12.75a1 1 0 0 1 1-1Z" />
          <path d="M13.75 4.75v3.5h3.5" />
        </svg>
      `;
    case "file-code":
      return `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M7.75 4.5h6.2l3.3 3.3v10.45a1 1 0 0 1-1 1H7.75a1 1 0 0 1-1-1v-12.75a1 1 0 0 1 1-1Z" />
          <path d="M13.75 4.75v3.5h3.5" />
          <path d="m10 12-1.75 1.75L10 15.5" />
          <path d="m14 12 1.75 1.75L14 15.5" />
        </svg>
      `;
    case "file-config":
      return `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M7.75 4.5h6.2l3.3 3.3v10.45a1 1 0 0 1-1 1H7.75a1 1 0 0 1-1-1v-12.75a1 1 0 0 1 1-1Z" />
          <path d="M13.75 4.75v3.5h3.5" />
          <path d="M9.25 14h5.5M9.25 17h5.5M9.25 11h2.5" />
        </svg>
      `;
    default:
      return "";
  }
}

const activityItems: ActivityItem[] = [
  { id: "explorer", label: "Explorer", icon: iconMarkup("explorer") },
  { id: "search", label: "Search", icon: iconMarkup("search") },
  { id: "source-control", label: "Source Control", icon: iconMarkup("source-control") },
  { id: "run", label: "Run and Debug", icon: iconMarkup("run") },
  { id: "extensions", label: "Extensions", icon: iconMarkup("extensions") },
];

const activityFooterItems: ActivityItem[] = [
  { id: "account", label: "Account", icon: iconMarkup("account") },
  { id: "settings", label: "Manage", icon: iconMarkup("settings") },
];

const defaultSnapshot: EditorSnapshot = {
  charCount: 0,
  content: "",
  currentColumn: 1,
  currentLine: 1,
  lineCount: 1,
};

const title = ref("Untitled");
const editorHostElement = ref<HTMLElement | null>(null);
const editorHandle = ref<EditorHandle | null>(null);
const editorReady = ref(false);
const editorSnapshot = ref<EditorSnapshot>(defaultSnapshot);
const selectedActivity = ref("explorer");

onMounted(() => {
  if (!editorHostElement.value) {
    return;
  }

  editorHandle.value = mountEditor(editorHostElement.value, {
    onChange(snapshot) {
      editorSnapshot.value = snapshot;
    },
    placeholder: "Write system description...",
  });
  editorReady.value = true;
  editorHandle.value.focus();
});

onBeforeUnmount(() => {
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
  grid-template-columns: auto 1fr;
  gap: 1rem;
  align-items: center;
  padding: 0.25rem 1rem;
  position: relative;
  z-index: 1;
  background: rgba(255, 255, 255, 0.96);
  border-bottom: 1px solid var(--project-create-border);
}

.project-create__brand-group {
  display: flex;
  align-items: center;
  gap: 0.85rem;
  min-width: 0;
}

.project-create__brand {
  padding: 0rem 0.7rem;
  border: 1px solid rgba(9, 105, 218, 0.2);
  border-radius: 0.8rem;
  background: #f6f8fa;
  color: var(--project-create-accent);
  font-size: 0.82rem;
  font-weight: 700;
  letter-spacing: 0.16em;
}

.project-create__back-link {
  color: var(--project-create-muted);
  font-size: 0.8rem;
  font-weight: 600;
  text-decoration: none;
  transition: color 160ms ease;
}

.project-create__back-link:hover {
  color: var(--project-create-accent);
}

.project-create__title-slot {
  min-width: 0;
  display: flex;
  justify-content: center;
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

.project-create__side-shell {
  display: flex;
  flex: 0 0 19.5rem;
  min-width: 19.5rem;
  border-right: 1px solid var(--project-create-border);
  background: rgba(255, 255, 255, 0.92);
}

.project-create__activitybar {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  width: 3rem;
  padding: 0.35rem 0;
  border-right: 1px solid var(--project-create-border);
  background: #f6f8fa;
}

.project-create__activity-group {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
  align-items: center;
}

.project-create__activity-group--bottom {
  padding-bottom: 0.15rem;
}

.project-create__activity-button {
  position: relative;
  width: 100%;
  height: 2.5rem;
  border: 0;
  background: transparent;
  color: var(--project-create-muted);
  transition:
    background-color 140ms ease,
    color 140ms ease;
}

.project-create__activity-button:hover {
  background: var(--project-create-hover);
  color: var(--project-create-foreground);
}

.project-create__activity-button--active {
  color: var(--project-create-foreground);
  background: rgba(9, 105, 218, 0.06);
}

.project-create__activity-button--active::before {
  position: absolute;
  left: 0;
  top: 0.4rem;
  bottom: 0.4rem;
  width: 2px;
  border-radius: 999px;
  background: var(--project-create-accent);
  content: "";
}

.project-create__activity-icon {
  display: inline-flex;
  width: 1.15rem;
  height: 1.15rem;
}

.project-create__activity-icon :deep(svg),
.project-create__tree-icon :deep(svg) {
  width: 100%;
  height: 100%;
}

.project-create__sidebar {
  display: flex;
  flex-direction: column;
  min-width: 0;
  flex: 1 1 auto;
}

.project-create__sidebar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.5rem 0.75rem 0.45rem;
  border-bottom: 1px solid rgba(208, 215, 222, 0.7);
}

.project-create__sidebar-title {
  color: var(--project-create-muted);
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.project-create__sidebar-action {
  display: inline-flex;
  align-items: center;
  gap: 0.15rem;
  padding: 0.25rem 0.3rem;
  border: 0;
  border-radius: 0.4rem;
  background: transparent;
  color: var(--project-create-muted);
}

.project-create__sidebar-action:hover {
  background: var(--project-create-hover);
  color: var(--project-create-foreground);
}

.project-create__sidebar-action-dot {
  width: 0.18rem;
  height: 0.18rem;
  border-radius: 999px;
  background: currentColor;
}

.project-create__sidebar-section {
  flex: 1 1 auto;
  min-height: 0;
  overflow: auto;
  padding-top: 0.4rem;
}

.project-create__sidebar-section-heading,
.project-create__sidebar-fold {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  width: 100%;
  padding: 0.15rem 0.75rem;
  border: 0;
  background: transparent;
  color: var(--project-create-foreground);
  font-size: 0.77rem;
  font-weight: 700;
  letter-spacing: 0.02em;
  text-align: left;
  text-transform: uppercase;
}

.project-create__sidebar-section-label {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.project-create__tree {
  padding-top: 0.15rem;
}

.project-create__tree-row {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  width: 100%;
  min-height: 1.6rem;
  border: 0;
  background: transparent;
  color: var(--project-create-foreground);
  font-size: 0.84rem;
  text-align: left;
  transition:
    background-color 140ms ease,
    color 140ms ease;
}

.project-create__tree-row:hover {
  background: var(--project-create-hover);
}

.project-create__tree-row--active {
  background: var(--project-create-selected);
}

.project-create__tree-caret {
  display: inline-flex;
  justify-content: center;
  width: 0.7rem;
  color: var(--project-create-muted);
  font-size: 0.9rem;
  flex: 0 0 auto;
}

.project-create__tree-caret--empty {
  opacity: 0;
}

.project-create__tree-icon {
  display: inline-flex;
  width: 0.95rem;
  height: 0.95rem;
  color: #57606a;
  flex: 0 0 auto;
}

.project-create__tree-row--active .project-create__tree-icon {
  color: var(--project-create-accent);
}

.project-create__tree-label {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.project-create__tree-meta {
  margin-left: auto;
  padding-right: 0.65rem;
  color: var(--project-create-accent);
  font-size: 0.72rem;
  font-weight: 700;
}

.project-create__sidebar-footer {
  border-top: 1px solid rgba(208, 215, 222, 0.7);
  padding: 0.35rem 0 0.5rem;
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
  border-bottom-color: transparent;
  background: #ffffff;
  color: var(--project-create-foreground);
  font-size: 0.78rem;
  font-weight: 600;
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
  padding: 1rem;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.9), rgba(248, 250, 252, 0.92));
  overflow: hidden;
}

.project-create__editor-host {
  flex: 1 1 auto;
  min-height: 0;
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

@media (max-width: 991.98px) {
  .project-create__layout {
    flex-direction: column;
  }

  .project-create__side-shell {
    flex: 0 0 auto;
    min-width: 0;
    height: 19rem;
    border-right: 0;
    border-bottom: 1px solid var(--project-create-border);
  }

  .project-create__workspace {
    min-height: 20rem;
  }
}

@media (max-width: 767.98px) {
  .project-create__topbar,
  .project-create__statusbar {
    padding-left: 0.85rem;
    padding-right: 0.85rem;
  }

  .project-create__topbar {
    grid-template-columns: 1fr;
    gap: 0.75rem;
  }

  .project-create__title-input {
    width: 100%;
  }

  .project-create__side-shell {
    height: 16rem;
  }

  .project-create__editor-toolbar {
    padding-left: 0.7rem;
    padding-right: 0.7rem;
  }

  .project-create__editor-panel {
    padding: 0.7rem;
  }

  .project-create__statusbar {
    gap: 0.85rem;
    overflow-x: auto;
  }
}
</style>
