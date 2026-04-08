<template>
  <router-view v-if="isStandaloneLayout" />
  <div
    v-else
    class="g-sidenav-show app-layout"
    :class="{ 'g-sidenav-hidden': isMiniSidebar }"
  >
    <SideNav
      :isMiniSidebar="isMiniSidebar"
      @toggle-sidebar="toggleSidebar"
    />

    <main class="main-content position-relative">
      <div class="main-content__surface">
        <div class="main-content__scroll">
          <router-view />
        </div>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from "vue";
import { useRoute } from "vue-router";

import SideNav from "./components/Sidenav/index.vue";

// false = Full Sidebar, true = Just Icons
const isMiniSidebar = ref(window.innerWidth < 1200);
const route = useRoute();
const isStandaloneLayout = computed(() => route.meta.layout === "standalone");

function toggleSidebar() {
  isMiniSidebar.value = !isMiniSidebar.value;
}

function handleResize() {
  if (window.innerWidth < 1200) {
    isMiniSidebar.value = true;
  }
}

onMounted(() => {
  window.addEventListener('resize', handleResize);
});

onUnmounted(() => {
  window.removeEventListener('resize', handleResize);
});
</script>

<style scoped>
:global(html),
:global(body),
:global(#app) {
  height: 100%;
}

:global(body) {
  overflow: hidden;
}

.app-layout {
  display: flex !important;
  flex-direction: row !important;
  box-sizing: border-box;
  height: 100vh;
  height: 100dvh;
  padding: 0.5rem;
  overflow: hidden;
  background:
    radial-gradient(circle at top right, rgba(130, 214, 22, 0.1), transparent 24%),
    linear-gradient(180deg, #f7f9fc 0%, #f1f5f9 100%);
}

:global(.app-layout .sidenav) {
  position: relative !important;
  transform: none !important;
  margin: 0 !important;
  margin-right: 0.5rem !important;
  height: 100% !important;
  flex-shrink: 0;
  transition: width 0.3s ease, min-width 0.3s ease, max-width 0.3s ease !important;
}

:global(.app-layout:not(.g-sidenav-hidden) .sidenav) {
  width: 15.5rem !important;
  max-width: 15.5rem !important;
  min-width: 15.5rem !important;
}

:global(.app-layout.g-sidenav-hidden .sidenav) {
  width: 6rem !important;
  max-width: 6rem !important;
  min-width: 6rem !important;
  overflow: hidden !important;
}

.main-content {
  flex: 1 1 auto;
  min-width: 0;
  height: 100%;
  padding-left: 0 !important;
  margin-left: 0 !important;
}

.main-content__surface {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
  border: 1px solid rgba(226, 232, 240, 0.9);
  border-radius: 0.75rem;
  background: rgba(255, 255, 255, 0.96);
  box-shadow:
    0 24px 48px rgba(15, 23, 42, 0.08),
    0 8px 18px rgba(148, 163, 184, 0.16);
}

.main-content__scroll {
  flex: 1 1 auto;
  min-height: 0;
  overflow-x: hidden;
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-gutter: stable;
}

@media (max-width: 1199.98px) {
  :global(.app-layout .sidenav) {
    transform: none !important;
  }
  :global(.app-layout.g-sidenav-hidden .sidenav) {
    width: 6rem !important;
    max-width: 6rem !important;
    min-width: 6rem !important;
    overflow: hidden !important;
  }
  .main-content {
    margin-left: 0 !important;
  }
}

@media (max-width: 575.98px) {
  .app-layout {
    padding: 0.5rem;
  }

  .main-content {
    margin-left: 0 !important;
    padding-left: 0 !important;
  }
  
  :global(.app-layout.g-sidenav-hidden .sidenav) {
    width: 4.5rem !important;
    max-width: 4.5rem !important;
    min-width: 4.5rem !important;
    margin-right: 0.25rem !important;
  }

  .main-content__surface {
    border-radius: 1.5rem;
  }
}
</style>
