<template>
  <svg
    class="sidenav-line-icon"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <template v-if="name === 'home'">
      <path d="M4.75 10.5 12 4.75l7.25 5.75" />
      <path d="M6.5 9.75v8.75h11V9.75" />
      <path d="M9.25 18.5v-4.75h5.5v4.75" />
    </template>

    <template v-else-if="name === 'project'">
      <path d="M3.75 7.25h5l1.5 1.75h10v8.75a1.75 1.75 0 0 1-1.75 1.75H5.5a1.75 1.75 0 0 1-1.75-1.75V7.25Z" />
      <path d="M3.75 9h16.5" />
    </template>

    <template v-else-if="name === 'template'">
      <path d="M8.25 3.75h6l4 4v12.5H8.25A2.5 2.5 0 0 1 5.75 17.75V6.25a2.5 2.5 0 0 1 2.5-2.5Z" />
      <path d="M14.25 3.75v4h4" />
      <path d="M9 11h6.5" />
      <path d="M9 14.25h6.5" />
      <path d="M9 17.5h4.25" />
    </template>

    <template v-else-if="name === 'documents'">
      <path d="M6.75 5.25h7.5a2 2 0 0 1 2 2v9.5a2 2 0 0 1-2 2h-7.5a2 2 0 0 1-2-2v-9.5a2 2 0 0 1 2-2Z" />
      <path d="M8.75 9h6.5" />
      <path d="M8.75 12h6.5" />
      <path d="M8.75 15h4.5" />
      <path d="M16.25 8.25h1a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H9.5a2 2 0 0 1-2-2v-1" />
    </template>

    <template v-else-if="name === 'pricing'">
      <path d="M4.5 7.25h15a1.75 1.75 0 0 1 1.75 1.75v6a1.75 1.75 0 0 1-1.75 1.75h-15A1.75 1.75 0 0 1 2.75 15V9A1.75 1.75 0 0 1 4.5 7.25Z" />
      <path d="M2.75 10.5h18.5" />
      <path d="M6.5 14.5h3.5" />
    </template>

    <template v-else-if="name === 'settings'">
      <path d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z" />
      <path d="M18.25 12a6.53 6.53 0 0 0-.11-1.17l1.69-1.31-1.5-2.6-2.03.58a6.88 6.88 0 0 0-2.02-1.17L14 3.75h-3l-.28 2.58a6.88 6.88 0 0 0-2.02 1.17l-2.03-.58-1.5 2.6 1.69 1.31a6.53 6.53 0 0 0 0 2.34l-1.69 1.31 1.5 2.6 2.03-.58c.6.49 1.29.89 2.02 1.17L11 20.25h3l.28-2.58a6.88 6.88 0 0 0 2.02-1.17l2.03.58 1.5-2.6-1.69-1.31c.07-.38.11-.77.11-1.17Z" />
    </template>
  </svg>
</template>

<script setup lang="ts">
defineOptions({ name: "SidenavLineIcon" });

defineProps<{
  name: "home" | "project" | "template" | "documents" | "pricing" | "settings";
}>();
</script>

<style scoped>
.sidenav-line-icon {
  width: 1.1rem;
  height: 1.1rem;
  stroke: currentColor;
  stroke-width: 1.65;
  stroke-linecap: round;
  stroke-linejoin: round;
  vector-effect: non-scaling-stroke;
}
</style>
