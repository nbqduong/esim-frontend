<template>
  <div class="catalog-search">
    <label class="catalog-search__label" for="catalog-search-input">
      What component do you want to build?
    </label>
    <div class="input-group input-group-outline catalog-search__group">
      <input
        id="catalog-search-input"
        :value="modelValue"
        :placeholder="placeholder"
        class="form-control"
        type="search"
        @input="handleInput"
      />
      <button
        v-if="modelValue"
        class="btn bg-gradient-dark mb-0"
        type="button"
        @click="emit('update:modelValue', '')"
      >
        Clear
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
defineOptions({ name: "CatalogSearchBar" });

defineProps<{
  modelValue: string;
  placeholder: string;
}>();

const emit = defineEmits<{
  (e: "update:modelValue", value: string): void;
}>();

function handleInput(event: Event) {
  emit("update:modelValue", (event.target as HTMLInputElement).value);
}
</script>

<style scoped>
.catalog-search__label {
  display: inline-block;
  margin-bottom: 0.75rem;
  color: #64748b;
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.catalog-search__group {
  align-items: stretch;
}

.catalog-search__group .form-control {
  border-radius: 0.9rem 0 0 0.9rem;
  background: rgba(255, 255, 255, 0.92);
}

.catalog-search__group .btn {
  border-radius: 0 0.9rem 0.9rem 0;
}
</style>
