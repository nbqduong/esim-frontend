<script setup lang="ts">
import SideNav from "./components/Sidenav/index.vue";
</script>

<template>
  <header>
    <h1>Vue + TypeScript</h1>
  </header>
  <main>
    <SideNav />
    <router-view />
  </main>
</template>

<style scoped>
header {
  text-align: center;
  padding: 2rem;
}
main {
  max-width: 800px;
  margin: 0 auto;
  padding: 1rem;
}
</style>
