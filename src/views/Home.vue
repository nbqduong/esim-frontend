<template>
  <CatalogPage :sections="sections" />
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";

import CatalogPage from "@/components/catalog/CatalogPage.vue";
import type { CatalogSection } from "@/components/catalog/types";

defineOptions({ name: "Home" });

const sections = ref<CatalogSection[]>([]);
const isLoading = ref(true);
const hasError = ref(false);

const fallbackSections: CatalogSection[] = [
  {
    title: "Loading content",
    items: [{ title: "...." }],
  },
];

async function loadSections() {
  const response = await fetch(`${import.meta.env.BASE_URL}example/sample-data.json`);
  if (!response.ok) {
    throw new Error(`Failed to load sections: ${response.status}`);
  }
  const data = (await response.json()) as CatalogSection[];
  sections.value = data;
}

onMounted(async () => {
  isLoading.value = true;
  hasError.value = false;
  try {
    await loadSections();
  } catch (error) {
    console.error(error);
    hasError.value = true;
    sections.value = fallbackSections;
  } finally {
    isLoading.value = false;
  }
});
</script>
