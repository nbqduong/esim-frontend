<template>
  <div class="container mt-4">
    <div class="card p-4 shadow-sm text-center">
      
      <div v-if="loading">
        <p>Loading...</p>
      </div>
      
      <div v-else-if="isAuthenticated">
        <div class="mb-3">
          <img :src="avatarUrl" alt="User Avatar" class="rounded-circle" style="width: 80px; height: 80px;">
        </div>
        <h5 class="mb-1">{{ userEmail }}</h5>
        
        <div class="my-4 p-3 bg-light rounded text-start">
          <h4 class="mb-3 text-center">My Balance: ${{ (userBalance / 100).toFixed(2) }}</h4>
          <div class="d-flex justify-content-center gap-2">
            <button class="btn btn-success" @click="topup(1000)" :disabled="balanceLoading">+ $10.00</button>
            <button class="btn btn-warning" @click="topup(5000)" :disabled="balanceLoading">+ $50.00</button>
            <button class="btn btn-danger" @click="deduct(500)" :disabled="balanceLoading">- $5.00</button>
          </div>
        </div>

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
import { backendUrl } from '@/lib/backend';

const isAuthenticated = ref(false);
const loading = ref(true);
const balanceLoading = ref(false);
const userEmail = ref("");
const avatarUrl = ref("https://ui-avatars.com/api/?name=U&background=random");
const userBalance = ref(0);

onMounted(async () => {
  try {
    const response = await fetch(backendUrl('/auth/me'), {
      credentials: "include",
    });
    if (response.ok) {
      const data = await response.json();
      
      const profileRes = await fetch(backendUrl('/api/users/me'), {
        credentials: "include",
      });
      if (profileRes.ok) {
        const profile = await profileRes.json();
        userBalance.value = profile.balance;
      }
      
      isAuthenticated.value = true;
      userEmail.value = data.email;
      avatarUrl.value = `https://ui-avatars.com/api/?name=${encodeURIComponent(data.email)}&background=random`;
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
  window.location.href = backendUrl('/auth/google/login');
};

const topup = async (amountCents: number) => {
  balanceLoading.value = true;
  try {
    const res = await fetch(backendUrl('/api/users/me/balance/topup'), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ amount_cents: amountCents })
    });
    if (res.ok) {
      const data = await res.json();
      userBalance.value = data.new_balance_cents;
    }
  } catch (e) {
    console.error(e);
  } finally {
    balanceLoading.value = false;
  }
};

const deduct = async (amountCents: number) => {
  balanceLoading.value = true;
  try {
    const res = await fetch(backendUrl('/api/users/me/balance/deduct'), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ amount_cents: amountCents })
    });
    if (res.ok) {
      const data = await res.json();
      userBalance.value = data.new_balance_cents;
    } else {
      alert("Insufficient funds to perform this action.");
    }
  } catch (e) {
    console.error(e);
  } finally {
    balanceLoading.value = false;
  }
};

const logout = async () => {
  loading.value = true;
  try {
    await fetch(backendUrl('/auth/logout'), {
      method: "POST",
      credentials: "include",
    });
  } catch (error) {
    console.error("Logout failed", error);
  }
  isAuthenticated.value = false;
  loading.value = false;
  window.location.reload();
};
</script>
