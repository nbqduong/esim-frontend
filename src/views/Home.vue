<template>
  <CatalogPage :sections="sections" />
</template>

<script setup lang="ts">
import CatalogPage from "@/components/catalog/CatalogPage.vue";
import type { CatalogSection } from "@/components/catalog/types";

defineOptions({ name: "Home" });

const sections: CatalogSection[] = [
  {
    title: "Premium features",
    items: [
      {
        title: "Premium showcase",
      },
    ],
  },
  {
    title: "Recent projects",
    items: [
      {
        title: "Project A",
      },
      {
        title: "Project A",
      },
      {
        title: "Project A",
      },
      {
        title: "Project A",
      },
    ],
  },
  {
    title: "Recommend projects",
    items: [
      {
        title: "Mix showcase",
      },
      {
        title: "Mix showcase",
      },
      {
        title: "Mix showcase",
      },
    ],
  },
];
</script>
