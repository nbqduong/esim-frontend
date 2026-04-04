<template>
  <CatalogPage :sections="sections" />
</template>

<script setup lang="ts">
import CatalogPage from "@/components/catalog/CatalogPage.vue";
import type { CatalogSection } from "@/components/catalog/types";

defineOptions({ name: "Project" });

const sections: CatalogSection[] = [
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
  }
];
</script>
