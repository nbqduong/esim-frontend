<template>
  <aside
    class="my-3 overflow-auto border-0 sidenav navbar navbar-vertical navbar-expand-xs border-radius-xl fixed-start ms-3"
    id="sidenav-main"
    style="overflow-x: hidden !important;"
  >
    <SidenavList :isMiniSidebar="isMiniSidebar" />
  </aside>
</template>
<script lang="ts">
import SidenavList from "./SidenavList.vue";

export default {
  name: "index",
  components: {
    SidenavList,
  },
  props: {
    customClass: {
      type: String,
      default: "",
    },
    isMiniSidebar: {
      type: Boolean,
      default: false,
    },
  },
};
</script>
