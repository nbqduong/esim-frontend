<template>
  <router-link class="nav-link" :to="to" v-bind="$attrs">
    <div
      class="text-center icon d-flex align-items-center justify-content-center sidenav-collapse__icon"
      :class="'me-2'"
    >
      <slot name="icon"></slot>
    </div>
    <span
      v-show="!isMiniSidebar"
      class="nav-link-text"
      :class="'ms-1'"
      >{{ navText }}</span
    >
  </router-link>
</template>
<script lang="ts">
import { inject } from "vue";

export default {
  name: "sidenav-collapse",
  props: {
    to: {
      type: [Object, String],
      required: true,
    },
    navText: {
      type: String,
      required: true,
    },
  },
  setup() {
    const isMiniSidebar = inject("isMiniSidebar", false);
    return {
      isMiniSidebar
    }
  },
  data() {
    return {
      isExpanded: false,
    };
  },
};
</script>
<style scoped>
.sidenav-collapse__icon {
  color: #64748b;
  background: transparent !important;
  box-shadow: none !important;
  border-radius: 0.5rem;
  transition:
    color 0.18s ease,
    transform 0.18s ease;
}

.nav-link:hover .sidenav-collapse__icon {
  color: #0f172a;
  transform: translateY(-1px);
}

.nav-link.active .sidenav-collapse__icon {
  color: #0f172a;
  background: transparent !important;
}

.nav-link.active .sidenav-collapse__icon :deep(svg) {
  color: inherit;
}
</style>
