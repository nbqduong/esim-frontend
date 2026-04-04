<template>
  <!-- Dynamically bind the hidden class based on a Vue state variable -->
  <div
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
import { ref } from 'vue';
import SideNav from "./components/Sidenav/index.vue";

// false = Full Sidebar, true = Just Icons
const isMiniSidebar = ref(false); 

function toggleSidebar() {
  isMiniSidebar.value = !isMiniSidebar.value;
}
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
  box-sizing: border-box;
  height: 100vh;
  height: 100dvh;
  padding: 0.25rem 0.25rem 0rem 0;
  overflow: hidden;
  background:
    radial-gradient(circle at top right, rgba(130, 214, 22, 0.1), transparent 24%),
    linear-gradient(180deg, #f7f9fc 0%, #f1f5f9 100%);
}

.main-content {
  height: 100%;
  min-height: 0;
  padding-left: 0.75rem;
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

@media (max-width: 575.98px) {
  .app-layout {
    padding: 0.5rem;
  }

  .main-content {
    padding-left: 0;
  }

  .main-content__surface {
    border-radius: 1.5rem;
  }
}
</style>
