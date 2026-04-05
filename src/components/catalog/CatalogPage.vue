<template>
  <div class="container-fluid py-4 catalog-page">
    <div class="row mb-4">
      <div class="col-12">
        <div class="card border-0 shadow-sm overflow-hidden catalog-page__hero">
          <div class="card-body catalog-page__hero-body">
            <CatalogSearchBar
              v-model="query"
              :placeholder="searchPlaceholder"
            />
          </div>
        </div>
      </div>
    </div>

    <div v-if="$slots.lead" class="row mb-4">
      <div class="col-12">
        <slot name="lead" />
      </div>
    </div>

    <div v-if="query && !hasResults" class="row mb-4">
      <div class="col-12">
        <div class="card border-0 shadow-sm border-radius-xl">
          <div class="card-body p-4">
            <h6 class="mb-2">No results for "{{ query }}"</h6>
            <p class="text-sm text-secondary mb-0">
              Try a different keyword to search across section and card titles.
            </p>
          </div>
        </div>
      </div>
    </div>

    <CatalogSection
      v-for="section in filteredSections"
      :key="section.title"
      :section="section"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";

import CatalogSearchBar from "./CatalogSearchBar.vue";
import CatalogSection from "./CatalogSection.vue";
import type { CatalogSection as CatalogSectionType } from "./types";

defineOptions({ name: "CatalogPage" });

const props = withDefaults(
  defineProps<{
    sections: CatalogSectionType[];
    searchPlaceholder?: string;
  }>(),
  {
    searchPlaceholder: "Search",
  },
);

const query = ref("");

const normalizedQuery = computed(() => query.value.trim().toLowerCase());

function matchesItem(section: CatalogSectionType, term: string) {
  const sectionText = section.title.toLowerCase();
  if (sectionText.includes(term)) {
    return section.items;
  }

  return section.items.filter((item) => item.title.toLowerCase().includes(term));
}

const filteredSections = computed(() => {
  if (!normalizedQuery.value) {
    return props.sections;
  }

  return props.sections
    .map((section) => ({
      ...section,
      items: matchesItem(section, normalizedQuery.value),
    }))
    .filter((section) => section.items.length > 0);
});

const hasResults = computed(() => filteredSections.value.length > 0);
</script>

<style scoped>
.catalog-page {
  padding-left: 1.5rem;
  padding-right: 1.5rem;
}

.catalog-page__hero {
  border-radius: 1.5rem;
  background:
    radial-gradient(circle at top right, rgba(130, 214, 22, 0.18), transparent 26%),
    linear-gradient(135deg, rgba(255, 255, 255, 0.98), rgba(244, 247, 251, 0.94));
}

.catalog-page__hero-body {
  padding: 2rem 3rem;
}

@media (max-width: 991.98px) {
  .catalog-page {
    padding-left: 1rem;
    padding-right: 1rem;
  }

  .catalog-page__hero-body {
    padding: 1.75rem 2rem;
  }
}

@media (max-width: 575.98px) {
  .catalog-page {
    padding-left: 0.75rem;
    padding-right: 0.75rem;
  }

  .catalog-page__hero-body {
    padding: 1.5rem 1.25rem;
  }
}
</style>
