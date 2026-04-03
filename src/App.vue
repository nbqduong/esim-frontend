<template>
  <!-- Dynamically bind the hidden class based on a Vue state variable -->
  <div class="g-sidenav-show" :class="{ 'g-sidenav-hidden': isMiniSidebar }">
    
    <SideNav :isMiniSidebar="isMiniSidebar" />
    
    <main class="main-content position-relative max-height-vh-100 h-100 border-radius-lg">
      <!-- Example button to toggle the state -->
      <button @click="toggleSidebar" class="btn btn-primary m-3">
        Toggle Sidebar
      </button>

      <router-view />
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
