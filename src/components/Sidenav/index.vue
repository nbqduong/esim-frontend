<template>
  <aside
    class="my-3 overflow-auto border-0 sidenav navbar navbar-vertical navbar-expand-xs border-radius-xl fixed-start ms-1"
    :class="customClass"
    id="sidenav-main"
    style="overflow-x: hidden !important;"
  >
    <div class="sidenav-header">
      <button
        class="sidenav-toggler"
        :class="{ 'sidenav-toggler--mini': isMiniSidebar }"
        type="button"
        :aria-pressed="isMiniSidebar"
        :aria-label="isMiniSidebar ? 'Expand sidebar' : 'Collapse sidebar'"
        @click="emit('toggle-sidebar')"
      >
        <SidebarToggle
          class="sidenav-toggler__icon"
          :active="isMiniSidebar"
          aria-hidden="true"
        />
      </button>
    </div>
    <hr class="horizontal dark mt-0" />
    <SidenavList :isMiniSidebar="isMiniSidebar" />
  </aside>
</template>
<script setup lang="ts">
import SidebarToggle from "../../assets/Icon/SidebarToggle.vue";
import SidenavList from "./SidenavList.vue";

const { customClass = "", isMiniSidebar = false } = defineProps<{
  customClass?: string;
  isMiniSidebar?: boolean;
}>();

const emit = defineEmits<{
  (e: "toggle-sidebar"): void;
}>();
</script>
