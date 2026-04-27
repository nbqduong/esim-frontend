<template>
  <div ref="rootElement" class="system-menu">
    <button
      class="system-menu__button"
      :class="{ 'system-menu__button--open': menuOpen }"
      type="button"
      aria-haspopup="menu"
      :aria-expanded="menuOpen"
      aria-controls="project-system-menu"
      @click="toggleMenu"
    >
      <span
        class="system-menu__button-icon"
        aria-hidden="true"
        v-html="iconMarkup('menu')"
      ></span>
      <span>Menu</span>
    </button>

    <transition name="system-menu-fade">
      <div
        v-if="menuOpen"
        id="project-system-menu"
        class="system-menu__panel"
        role="menu"
      >
        <div class="system-menu__header">
          <strong>{{ title || "Untitled project" }}</strong>
          <span>{{ statusLabel }}</span>
        </div>

        <button
          class="system-menu__item"
          type="button"
          role="menuitem"
          @click="handleFile"
        >
          <span
            class="system-menu__item-icon"
            aria-hidden="true"
            v-html="iconMarkup('file')"
          ></span>
          <span>File</span>
          <span class="system-menu__item-note">Sample option</span>
          <span
            class="system-menu__chevron"
            aria-hidden="true"
            v-html="iconMarkup('chevron-right')"
          ></span>
        </button>

        <button
          class="system-menu__item"
          type="button"
          role="menuitem"
          @click="handleSettings"
        >
          <span
            class="system-menu__item-icon"
            aria-hidden="true"
            v-html="iconMarkup('settings')"
          ></span>
          <span>Settings</span>
          <span
            class="system-menu__chevron"
            aria-hidden="true"
            v-html="iconMarkup('chevron-right')"
          ></span>
        </button>

        <button
          class="system-menu__item"
          type="button"
          role="menuitem"
          :disabled="saveDisabled"
          @click="handleSave"
        >
          <span
            class="system-menu__item-icon"
            aria-hidden="true"
            v-html="iconMarkup('cloud-upload')"
          ></span>
          <span>{{ saveLabel }}</span>
        </button>
      </div>
    </transition>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from "vue";

defineOptions({ name: "SystemMenu" });

defineProps<{
  saveDisabled: boolean;
  saveLabel: string;
  statusLabel: string;
  title: string;
}>();

const emit = defineEmits<{
  file: [];
  save: [];
  settings: [];
}>();

const rootElement = ref<HTMLElement | null>(null);
const menuOpen = ref(false);

function iconMarkup(name: string) {
  switch (name) {
    case "chevron-right":
      return `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="m9.75 6.75 5.5 5.25-5.5 5.25" />
        </svg>
      `;
    case "cloud-upload":
      return `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M7.25 18.25h9a3.5 3.5 0 0 0 .2-7 5 5 0 0 0-9.75-1.35A3.75 3.75 0 0 0 7.25 18.25Z" />
          <path d="M12 9.75v7" />
          <path d="m9.5 12.25 2.5-2.5 2.5 2.5" />
        </svg>
      `;
    case "file":
      return `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M8 3.75h6l4.25 4.25v10.25a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V4.75a1 1 0 0 1 1-1Z" />
          <path d="M14 3.75V8h4.25" />
        </svg>
      `;
    case "menu":
      return `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M5.25 7.25h13.5" />
          <path d="M5.25 12h13.5" />
          <path d="M5.25 16.75h13.5" />
        </svg>
      `;
    case "settings":
      return `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="2.75" />
          <path d="M12 4.75v1.75M12 17.5v1.75M19.25 12H17.5M6.5 12H4.75M17.1 6.9l-1.25 1.25M8.15 15.85 6.9 17.1M17.1 17.1l-1.25-1.25M8.15 8.15 6.9 6.9" />
        </svg>
      `;
    default:
      return "";
  }
}

function closeMenu() {
  menuOpen.value = false;
}

function toggleMenu() {
  menuOpen.value = !menuOpen.value;
}

function handleDocumentPointerDown(event: PointerEvent) {
  const target = event.target;

  if (!(target instanceof Node) || rootElement.value?.contains(target)) {
    return;
  }

  closeMenu();
}

function handleFile() {
  closeMenu();
  emit("file");
}

function handleSettings() {
  closeMenu();
  emit("settings");
}

function handleSave() {
  closeMenu();
  emit("save");
}

onMounted(() => {
  document.addEventListener("pointerdown", handleDocumentPointerDown);
});

onBeforeUnmount(() => {
  document.removeEventListener("pointerdown", handleDocumentPointerDown);
});
</script>

<style scoped>
.system-menu {
  position: relative;
  flex: 0 0 auto;
}

.system-menu__button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.45rem;
  min-height: 1.8rem;
  padding: 0 0.68rem;
  border: 1px solid rgba(208, 215, 222, 0.85);
  border-radius: 0.5rem;
  background: #ffffff;
  color: #57606a;
  font-size: 0.78rem;
  font-weight: 700;
  white-space: nowrap;
  cursor: pointer;
  transition:
    background-color 140ms ease,
    border-color 140ms ease,
    color 140ms ease,
    box-shadow 140ms ease;
}

.system-menu__button:hover,
.system-menu__button--open {
  border-color: rgba(9, 105, 218, 0.28);
  background: rgba(9, 105, 218, 0.08);
  color: #0969da;
}

.system-menu__button:focus-visible {
  outline: 2px solid rgba(9, 105, 218, 0.28);
  outline-offset: 2px;
}

.system-menu__button-icon,
.system-menu__item-icon,
.system-menu__chevron {
  display: inline-flex;
  width: 1rem;
  height: 1rem;
  flex: 0 0 auto;
}

.system-menu__button-icon :deep(svg),
.system-menu__item-icon :deep(svg),
.system-menu__chevron :deep(svg) {
  width: 100%;
  height: 100%;
}

.system-menu__panel {
  position: absolute;
  top: calc(100% + 0.5rem);
  left: 0;
  width: min(22rem, 78vw);
  padding: 0.5rem;
  border: 1px solid rgba(208, 215, 222, 0.9);
  border-radius: 1rem;
  background: rgba(255, 255, 255, 0.98);
  box-shadow:
    0 18px 38px rgba(15, 23, 42, 0.14),
    0 2px 10px rgba(15, 23, 42, 0.08);
  backdrop-filter: blur(12px);
  z-index: 20;
}

.system-menu__header {
  display: flex;
  flex-direction: column;
  gap: 0.18rem;
  padding: 0.4rem 0.55rem 0.75rem;
  border-bottom: 1px solid rgba(208, 215, 222, 0.72);
}

.system-menu__header strong {
  font-size: 0.95rem;
  font-weight: 700;
  line-height: 1.25;
}

.system-menu__header span {
  color: #57606a;
  font-size: 0.74rem;
  font-weight: 600;
  text-transform: uppercase;
}

.system-menu__item {
  display: flex;
  align-items: center;
  gap: 0.7rem;
  width: 100%;
  min-height: 2.6rem;
  margin-top: 0.2rem;
  padding: 0 0.55rem;
  border: 0;
  border-radius: 0.8rem;
  background: transparent;
  color: #24292f;
  font-size: 0.84rem;
  font-weight: 600;
  text-align: left;
  cursor: pointer;
  transition:
    background-color 140ms ease,
    color 140ms ease;
}

.system-menu__item:hover:not(:disabled) {
  background: rgba(9, 105, 218, 0.08);
  color: #0969da;
}

.system-menu__item:disabled {
  opacity: 0.5;
  cursor: default;
}

.system-menu__item-note {
  color: #57606a;
  font-size: 0.75rem;
  font-weight: 500;
}

.system-menu__chevron {
  margin-left: auto;
}

.system-menu-fade-enter-active,
.system-menu-fade-leave-active {
  transition: opacity 160ms ease, transform 160ms ease;
}

.system-menu-fade-enter-from,
.system-menu-fade-leave-to {
  opacity: 0;
  transform: translateY(-0.35rem);
}

@media (max-width: 767.98px) {
  .system-menu__panel {
    width: min(20rem, calc(100vw - 1.7rem));
  }
}
</style>
