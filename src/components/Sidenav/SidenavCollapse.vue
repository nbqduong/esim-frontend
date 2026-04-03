<template>
  <router-link class="nav-link" :to="to" v-bind="$attrs">
    <div
      class="text-center bg-white shadow icon icon-shape icon-sm border-radius-md d-flex align-items-center justify-content-center"
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
