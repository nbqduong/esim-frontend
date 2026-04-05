<template>
  <CatalogPage :sections="sections">
    <template #lead>
      <CatalogCreateCard />
    </template>
  </CatalogPage>
</template>

<script setup lang="ts">
import CatalogCreateCard from "@/components/catalog/CatalogCreateCard.vue";
import CatalogPage from "@/components/catalog/CatalogPage.vue";
import type { CatalogSection } from "@/components/catalog/types";
import { onMounted, ref } from "vue";

defineOptions({ name: "Project" });


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
  sections.value = data.filter((section) => section.title === "Recent projects");
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
