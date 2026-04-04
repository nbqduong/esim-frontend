<template>
  <section class="catalog-section mb-4">
    <h4 class="catalog-section__title mb-3">{{ section.title }}</h4>

    <div v-if="section.items.length" class="d-flex flex-wrap gap-6 mb-4">
      <CatalogCard
        v-for="item in section.items"
        :key="item.title"
        :item="item"
        class="flex-shrink-0"
      />
    </div>

    <div v-else class="card border-0 shadow-sm border-radius-xl">
      <div class="card-body p-4">
        <p class="text-sm text-secondary mb-0">
          {{ section.emptyText ?? "No matching items yet." }}
        </p>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import CatalogCard from "./CatalogCard.vue";
import type { CatalogSection as CatalogSectionType } from "./types";

defineOptions({ name: "CatalogSection" });

defineProps<{
  section: CatalogSectionType;
}>();
</script>

<style scoped>
.catalog-section__title {
  color: #344767;
}
</style>
