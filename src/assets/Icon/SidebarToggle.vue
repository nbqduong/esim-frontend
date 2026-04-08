<template>
  <svg
    :width="width"
    :height="height"
    viewBox="0 0 32 32"
    version="1.1"
    xmlns="http://www.w3.org/2000/svg"
    xmlns:xlink="http://www.w3.org/1999/xlink"
  >
    <title>sidebar-toggle</title>
    <g stroke="none" stroke-width="1" fill="none" fill-rule="evenodd">
      <path
        d="M 4.5 9 A 3.5 3.5 0 0 1 8 5.5 L 14.5 5.5 L 14.5 26.5 L 8 26.5 A 3.5 3.5 0 0 1 4.5 23 Z"
        fill="currentColor"
      />

      <rect
        x="4.5"
        y="5.5"
        width="23"
        height="21"
        rx="4"
        stroke="currentColor"
        stroke-width="2.2"
      />
    </g>
  </svg>
</template>

<script lang="ts">
export default {
  props: {
    active: {
      type: Boolean,
      default: false,
    },
    height: {
      type: String,
      default: "32px",
    },
    width: {
      type: String,
      default: "32px",
    },
  },
};
</script>
