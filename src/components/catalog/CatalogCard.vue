<template>
  <article class="card border-0 catalog-card catalog-card-size">
    <component
      :is="item.to ? RouterLink : 'div'"
      class="catalog-card__link"
      :to="item.to"
    >
      <div class="card-body p-0 d-flex flex-column catalog-card__body">
        <div class="catalog-card__preview-shell">
          <div class="catalog-card__preview-page">
            <div class="catalog-card__preview-lines">
              <span class="catalog-card__preview-line catalog-card__preview-line--xl"></span>
              <span class="catalog-card__preview-line catalog-card__preview-line--lg"></span>
              <span class="catalog-card__preview-line catalog-card__preview-line--md"></span>
              <span class="catalog-card__preview-line catalog-card__preview-line--sm"></span>
              <span class="catalog-card__preview-line catalog-card__preview-line--lg"></span>
              <span class="catalog-card__preview-line catalog-card__preview-line--xs"></span>
            </div>
          </div>
        </div>

        <div class="catalog-card__content">
          <div v-if="item.updatedLabel" class="catalog-card__eyebrow">
            {{ item.updatedLabel }}
          </div>
          <h5 class="catalog-card__title mb-0">
            {{ item.title }}
          </h5>
          <p v-if="item.subtitle" class="catalog-card__subtitle mb-0">
            {{ item.subtitle }}
          </p>
        </div>
      </div>
    </component>
  </article>
</template>

<script setup lang="ts">
import { RouterLink } from "vue-router";

import type { CatalogCardItem } from "./types";

defineOptions({ name: "CatalogCard" });

defineProps<{
  item: CatalogCardItem;
}>();
</script>

<style scoped>
@import "./catalog-card-size.css";

.catalog-card {
  border-radius: 1.25rem;
  background: transparent;
  box-shadow: none;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.catalog-card__link {
  display: flex;
  flex: 1 1 auto;
  height: 100%;
  color: inherit;
  text-decoration: none;
}

.catalog-card__body {
  height: 100%;
}

.catalog-card:hover {
  transform: translateY(-2px);
}

.catalog-card__preview-shell {
  flex: 0 0 10.5rem;
  border-radius: 1.2rem;
  background: #eef2f6;
  padding: 0.85rem;
  min-height: 10.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
}

.catalog-card__preview-page {
  width: min(72%, 8.8rem);
  min-height: 8.4rem;
  padding: 0.75rem 0.65rem;
  border: 1px solid rgba(203, 213, 225, 0.8);
  background: #ffffff;
  box-shadow: 0 18px 24px rgba(148, 163, 184, 0.18);
}

.catalog-card__preview-lines {
  display: grid;
  gap: 0.4rem;
}

.catalog-card__preview-line {
  display: block;
  height: 0.22rem;
  border-radius: 999px;
  background: rgba(148, 163, 184, 0.45);
}

.catalog-card__preview-line--xl {
  width: 92%;
}

.catalog-card__preview-line--lg {
  width: 84%;
}

.catalog-card__preview-line--md {
  width: 70%;
}

.catalog-card__preview-line--sm {
  width: 62%;
}

.catalog-card__preview-line--xs {
  width: 48%;
}

.catalog-card__content {
  flex: 1 1 auto;
  min-height: 0;
  padding: 0.85rem 0.1rem 0;
}

.catalog-card__eyebrow {
  color: #2563eb;
  font-size: 0.72rem;
  font-weight: 600;
  line-height: 1.2;
  margin-bottom: 0.35rem;
  text-transform: uppercase;
}

.catalog-card__title {
  color: #111827;
  font-size: 1rem;
  font-weight: 300;
  line-height: 1.3;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.catalog-card__subtitle {
  color: #6b7280;
  font-size: 0.83rem;
  line-height: 1.35;
  margin-top: 0.45rem;
}

@media (max-width: 575.98px) {
  .catalog-card__preview-shell {
    flex-basis: 9rem;
    min-height: 9rem;
  }

  .catalog-card__preview-page {
    width: min(72%, 7.4rem);
    min-height: 7rem;
  }

  .catalog-card__title {
    font-size: 0.95rem;
  }
}
</style>
