<template>
  <div class="user-button-container pb-4 px-3 w-100">
    <!-- Logged in state -->
    <div v-if="isAuthenticated" class="d-flex align-items-center mb-0 cursor-pointer" @click="goToSettings">
      <img
        :src="avatarUrl"
        alt="User Avatar"
        class="rounded-circle"
        style="width: 40px; height: 40px; object-fit: cover; border: 1px solid #dee2e6;"
        :class="{ 'me-2': !isMiniSidebar, 'mx-auto': isMiniSidebar }"
      />
      <div v-if="!isMiniSidebar" class="d-flex flex-column text-truncate">
        <span class="text-sm font-weight-bold text-dark text-truncate">{{ userEmail.split('@')[0] }}</span>
      </div>
    </div>
    
    <!-- Not logged in state -->
    <div v-else class="d-flex align-items-center mb-0 cursor-pointer" @click="loginWithGoogle">
      <div class="rounded-circle d-flex align-items-center justify-content-center bg-light" style="width: 40px; height: 40px; border: 1px solid #dee2e6;" :class="{ 'me-2': !isMiniSidebar, 'mx-auto': isMiniSidebar }">
        <svg xmlns="http://www.svgrepo.com/show/475656/google-color.svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-log-in"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"></path><polyline points="10 17 15 12 10 7"></polyline><line x1="15" y1="12" x2="3" y2="12"></line></svg>
      </div>
      <div v-if="!isMiniSidebar" class="d-flex flex-column text-truncate">
        <span class="text-sm font-weight-bold text-dark">Login</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { backendUrl } from '@/lib/backend';

defineProps<{
  isMiniSidebar: boolean;
}>();

const router = useRouter();
const isAuthenticated = ref(false);
const userEmail = ref("");
const avatarUrl = ref("https://ui-avatars.com/api/?name=U&background=random");

onMounted(async () => {
  try {
    const response = await fetch(backendUrl('/auth/me'), {
      credentials: "include",
    });
    if (response.ok) {
      const data = await response.json();
      isAuthenticated.value = true;
      userEmail.value = data.email;
      avatarUrl.value = `https://ui-avatars.com/api/?name=${encodeURIComponent(data.email)}&background=random`;
    } else {
      isAuthenticated.value = false;
    }
  } catch (error) {
    isAuthenticated.value = false;
  }
});

const loginWithGoogle = () => {
  window.location.href = backendUrl('/auth/google/login');
};

const goToSettings = () => {
  router.push({ name: 'User Settings' });
};
</script>

<style scoped>
.user-button-container {
  display: flex;
  margin-top: auto;
}
.cursor-pointer {
  cursor: pointer;
}
</style>
