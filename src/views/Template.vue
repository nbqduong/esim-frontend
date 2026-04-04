<template>
  <CatalogPage :sections="sections" />
</template>

<script setup lang="ts">
import CatalogPage from "@/components/catalog/CatalogPage.vue";
import type { CatalogSection } from "@/components/catalog/types";

defineOptions({ name: "Template" });

const sections: CatalogSection[] = [
  {
    title: "Premium template",
    items: [
      {
        title: "Premium template",
      },
      {
        title: "Premium template",
      },
      {
        title: "Premium template",
      },
    ],
  },
  {
    title: "Free template",
    items: [
      {
        title: "Free template",
      },
      {
        title: "Free template",
      },
      {
        title: "Free template",
      },
    ],
  },
];
</script>
