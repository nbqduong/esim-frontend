<template>
  <section class="screen-layout">
    <section class="screen-copy">
      <p class="eyebrow">CSV Screen</p>
      <h1>Spreadsheet-style catalog view</h1>
      <p class="lede">
        This screen reads the model catalog and expands it into
        an editable-looking table for quick scanning and export prep.
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

    <section class="document-panel" aria-label="CSV preview">
      <div v-if="loading" class="panel-overlay">
        {{ loadingMessage }}
      </div>

      <div v-else class="spreadsheet-shell">
        <table v-if="rows.length > 0" class="spreadsheet-table">
          <thead>
            <tr>
              <th>Model URL</th>
              <th>Object ID</th>
              <th>Name</th>
              <th>Description</th>
              <th>Default State</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in rows" :key="row.objectId">
              <td>{{ row.modelUrl }}</td>
              <td>{{ row.objectId }}</td>
              <td>{{ row.name }}</td>
              <td>{{ row.description }}</td>
              <td>{{ row.state }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { loadModelCatalogFromIndexedDB } from "@/data/modelCatalogDatabase";
import type { ModelCatalog } from "@/three/create3DViewer";

interface CatalogRow {
  description: string;
  modelUrl: string;
  name: string;
  objectId: string;
  state: string;
}

const props = defineProps<{
  catalogLoader?: () => Promise<ModelCatalog>;
}>();

const catalog = ref<ModelCatalog | null>(null);
const errorMessage = ref("");
const loading = ref(true);
const sourceLabel = computed(() =>
  props.catalogLoader ? "Current draft" : "IndexedDB"
);
const loadingMessage = computed(() => `Loading spreadsheet data from ${sourceLabel.value}...`);

const rows = computed<CatalogRow[]>(() => {
  if (!catalog.value) {
    return [];
  }

  return catalog.value.flatMap((entry) =>
    entry.objects.map((object) => ({
      description: object.description,
      modelUrl: entry.modelUrl,
      name: object.name,
      objectId: object.id,
      state: object.state,
    }))
  );
});

const summary = computed(() => {
  if (rows.value.length === 0) {
    return "";
  }

  return `${rows.value.length} rows expanded from the catalog in ${sourceLabel.value.toLowerCase()}.`;
});

onMounted(() => {
  const loadCatalog = props.catalogLoader ?? loadModelCatalogFromIndexedDB;

  void loadCatalog()
    .then((nextCatalog) => {
      catalog.value = nextCatalog;
    })
    .catch((error) => {
      console.error("Unable to load the CSV catalog", error);
      errorMessage.value = props.catalogLoader
        ? "The CSV screen could not load the current project draft."
        : "The CSV screen could not load the catalog from IndexedDB.";
    })
    .finally(() => {
      loading.value = false;
    });
});
</script>
