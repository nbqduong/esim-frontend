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
    <div class="sidenav-footer position-absolute w-100 bottom-0">
      <UserButton :isMiniSidebar="isMiniSidebar" />
    </div>
  </aside>
</template>
<script setup lang="ts">
import SidebarToggle from "../../assets/Icon/SidebarToggle.vue";
import SidenavList from "./SidenavList.vue";
import UserButton from "./UserButton.vue";

const { customClass = "", isMiniSidebar = false } = defineProps<{
  customClass?: string;
  isMiniSidebar?: boolean;
}>();

const emit = defineEmits<{
  (e: "toggle-sidebar"): void;
}>();
</script>

<style scoped>
.sidenav-toggler.sidenav-toggler--mini, .sidenav-toggler.sidenav-toggler--mini:active, .sidenav-toggler.sidenav-toggler--mini:focus {
  background: transparent !important;
  box-shadow: none !important;
  color: #4293f5 !important;
}

.sidenav-toggler, .sidenav-toggler:active, .sidenav-toggler:focus {
  background: transparent !important;
  box-shadow: none !important;
  outline: none !important;
  color: #344767 !important;
}
</style>
