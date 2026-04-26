<template>
  <section class="screen-layout">
    <section class="screen-copy">
      <p class="eyebrow">PDF Screen</p>
      <h1>Printable catalog snapshot</h1>
      <p class="lede">
        This screen reads the model catalog and lays it out as a
        document-style preview that is ready for export or printing.
      </p>

      <div class="control-panel">
        <p class="status-copy">
          Source:
          <span class="status-chip" data-status="running">{{ sourceLabel }}</span>
        </p>
        <p v-if="summary" class="meta-copy">{{ summary }}</p>
        <p v-if="errorMessage" class="error-copy" role="alert">
          {{ errorMessage }}
        </p>
      </div>
    </section>

    <section class="document-panel" aria-label="PDF preview">
      <div v-if="loading" class="panel-overlay">
        {{ loadingMessage }}
      </div>
      <article v-else-if="catalog" class="paper-sheet">
        <header class="paper-header">
          <p class="paper-kicker">Model Catalog</p>
          <h2>Simulation Asset Report</h2>
          <p>
            Generated from the catalog currently loaded in this workspace.
          </p>
        </header>

        <section
          v-for="entry in catalog"
          :key="entry.modelUrl"
          class="paper-section"
        >
          <div class="paper-section-header">
            <h3>{{ entry.modelUrl }}</h3>
            <span>{{ entry.objects.length }} objects</span>
          </div>

          <table class="paper-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Name</th>
                <th>Default State</th>
                <th>Description</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="object in entry.objects" :key="object.id">
                <td>{{ object.id }}</td>
                <td>{{ object.name }}</td>
                <td>{{ object.state }}</td>
                <td>{{ object.description }}</td>
              </tr>
            </tbody>
          </table>
        </section>
      </article>
    </section>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { loadModelCatalogFromIndexedDB } from "@/data/modelCatalogDatabase";
import type { ModelCatalog } from "@/three/create3DViewer";

const props = defineProps<{
  catalogLoader?: () => Promise<ModelCatalog>;
}>();

const catalog = ref<ModelCatalog | null>(null);
const errorMessage = ref("");
const loading = ref(true);
const sourceLabel = computed(() =>
  props.catalogLoader ? "Current draft" : "IndexedDB"
);
const loadingMessage = computed(() => `Loading document data from ${sourceLabel.value}...`);

const summary = computed(() => {
  if (!catalog.value) {
    return "";
  }

  const objectCount = catalog.value.reduce(
    (total, entry) => total + entry.objects.length,
    0
  );

  return `${catalog.value.length} models and ${objectCount} objects are included in this PDF preview from ${sourceLabel.value.toLowerCase()}.`;
});

onMounted(() => {
  const loadCatalog = props.catalogLoader ?? loadModelCatalogFromIndexedDB;

  void loadCatalog()
    .then((nextCatalog) => {
      catalog.value = nextCatalog;
    })
    .catch((error) => {
      console.error("Unable to load the PDF catalog", error);
      errorMessage.value = props.catalogLoader
        ? "The PDF screen could not load the current project draft."
        : "The PDF screen could not load the catalog from IndexedDB.";
    })
    .finally(() => {
      loading.value = false;
    });
});
</script>
