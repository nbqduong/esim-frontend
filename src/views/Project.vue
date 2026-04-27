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
import { listProjects } from "@/lib/projects";
import { onMounted, ref } from "vue";

defineOptions({ name: "Project" });

const sections = ref<CatalogSection[]>([]);
const isLoading = ref(true);
const hasError = ref(false);

const fallbackSections: CatalogSection[] = [
  {
    title: "Recent projects",
    items: [{ title: "Unable to load projects", subtitle: "Try again after signing in." }],
  },
];

async function loadSections() {
  const response = await listProjects();
  sections.value = [
    {
      title: "Recent projects",
      items: response.projects.map((project) => ({
        id: project.id,
        subtitle: project.content_updated_at
          ? `Checksum ${project.content_checksum?.slice(0, 12) ?? "pending"}`
          : "Stored in Cloud",
        title: project.title,
        to: {
          name: "Project Detail",
          params: {
            projectId: project.id,
          },
        },
        updatedLabel: project.content_updated_at
          ? `Updated ${new Date(project.content_updated_at).toLocaleString()}`
          : `Created ${new Date(project.created_at).toLocaleString()}`,
      })),
    },
  ];
}

onMounted(async () => {
  isLoading.value = true;
  hasError.value = false;
  try {
    await loadSections();
    if (sections.value[0]?.items.length === 0) {
      sections.value = [
        {
          title: "Recent projects",
          items: [{ title: "No projects yet", subtitle: "Use New Project to create one." }],
        },
      ];
    }
  } catch (error) {
    console.error(error);
    hasError.value = true;
    sections.value = fallbackSections;
  } finally {
    isLoading.value = false;
  }
});
</script>
