<template>
  <div class="container mt-4">
    <div class="card p-4 shadow-sm text-center">
      
      <div v-if="loading">
        <p>Loading...</p>
      </div>
      
      <div v-else-if="isAuthenticated">
        <div class="mb-3">
          <img src="https://ui-avatars.com/api/?name=User&background=random" alt="Default Avatar" class="rounded-circle" style="width: 80px; height: 80px;">
        </div>
        <h5 class="mb-1">{{ userEmail }}</h5>
        <div>
          <button class="btn btn-outline-danger" @click="logout">Logout</button>
        </div>
      </div>

      <div v-else>
        <button class="btn btn-outline-dark d-inline-flex align-items-center justify-content-center" @click="loginWithGoogle">
          <img src="https://www.svgrepo.com/show/475656/google-color.svg" alt="Google Logo" style="width: 20px; height: 20px; margin-right: 10px;">
          Login with Google
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';

const isAuthenticated = ref(false);
const loading = ref(true);
const userEmail = ref("");

// Automatically detect the backend URL based on where the UI is being served.
const backendBaseUrl = window.location.port === "5173" 
  ? `http://${window.location.hostname}:8000` 
  : window.location.origin;

onMounted(async () => {
  try {
    const response = await fetch(`${backendBaseUrl}/auth/me`);
    if (response.ok) {
      const data = await response.json();
      isAuthenticated.value = true;
      userEmail.value = data.email;
    } else {
      isAuthenticated.value = false;
    }
  } catch (error) {
    isAuthenticated.value = false;
  } finally {
    loading.value = false;
  }
});

const loginWithGoogle = () => {
  window.location.href = `${backendBaseUrl}/auth/google/login`;
};

const logout = async () => {
  loading.value = true;
  try {
    await fetch(`${backendBaseUrl}/auth/logout`, { method: "POST" });
  } catch (error) {
    console.error("Logout failed", error);
  }
  isAuthenticated.value = false;
  loading.value = false;
  window.location.reload();
};
</script>
