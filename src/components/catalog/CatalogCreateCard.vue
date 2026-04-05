<template>
  <section class="catalog-create-entry">
    <h4 class="catalog-create-entry__title mb-3">{{ heading }}</h4>

    <article class="card border-0 catalog-create-card catalog-card-size">
      <div class="card-body p-0 d-flex flex-column catalog-create-card__body">
        <div class="catalog-create-card__preview-shell">
          <div class="catalog-create-card__preview-page">
            <router-link
              class="catalog-create-card__plus-link"
              :to="{ name: 'Project Create' }"
              aria-label="Create a new project"
            >
              <span class="catalog-create-card__plus" aria-hidden="true">+</span>
            </router-link>
          </div>
        </div>

        <div class="catalog-create-card__content">
          <h5 class="catalog-create-card__label mb-0">
            {{ label }}
          </h5>
        </div>
      </div>
    </article>
  </section>
</template>

<script setup lang="ts">
defineOptions({ name: "CatalogCreateCard" });

withDefaults(
  defineProps<{
    heading?: string;
    label?: string;
  }>(),
  {
    heading: "",
    label: "New Project",
  },
);
</script>

<style scoped>
@import "./catalog-card-size.css";

.catalog-create-entry {
  display: block;
  max-width: 100%;
}

.catalog-create-entry__title {
  color: #0f172a;
  font-size: 1rem;
  font-weight: 500;
  letter-spacing: 0.01em;
}

.catalog-create-card {
  border-radius: 1.25rem;
  background: transparent;
  box-shadow: none;
}

.catalog-create-card__body {
  height: 100%;
}

.catalog-create-card__preview-shell {
  flex: 0 0 10.5rem;
  border-radius: 1.2rem;
  background:
    radial-gradient(circle at top left, rgba(59, 130, 246, 0.1), transparent 34%),
    linear-gradient(180deg, #eff5fb, #f8fbff);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.85rem;
  min-height: 10.5rem;
}

.catalog-create-card__preview-page {
  width: min(72%, 8.8rem);
  min-height: 8.4rem;
  border: 1px dashed rgba(96, 165, 250, 0.5);
  border-radius: 1rem;
  background:
    radial-gradient(circle at center, rgba(255, 255, 255, 0.98), rgba(241, 245, 249, 0.95));
  box-shadow: 0 18px 24px rgba(148, 163, 184, 0.12);
  display: flex;
  align-items: center;
  justify-content: center;
}

.catalog-create-card__content {
  flex: 1 1 auto;
  min-height: 0;
  padding: 0.85rem 0.1rem 0;
}

.catalog-create-card__label {
  color: #111827;
  font-size: 1rem;
  font-weight: 300;
  line-height: 1.3;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.catalog-create-card__plus {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.5rem;
  height: 2.5rem;
  border: 1px solid rgba(96, 165, 250, 0.35);
  border-radius: 999px;
  color: #2563eb;
  background: rgba(255, 255, 255, 0.88);
  box-shadow: 0 10px 24px rgba(59, 130, 246, 0.14);
  font-size: 1.45rem;
  line-height: 1;
}

.catalog-create-card__plus-link {
  display: inline-flex;
  text-decoration: none;
  border-radius: 999px;
  transition:
    transform 0.2s ease,
    filter 0.2s ease;
}

.catalog-create-card__plus-link:hover {
  transform: translateY(-1px);
  filter: brightness(1.03);
}

.catalog-create-card__plus-link:focus-visible {
  outline: 2px solid rgba(37, 99, 235, 0.35);
  outline-offset: 4px;
}

@media (max-width: 575.98px) {
  .catalog-create-card__preview-shell {
    flex-basis: 9rem;
    min-height: 9rem;
  }

  .catalog-create-card__preview-page {
    width: min(72%, 7.4rem);
    min-height: 7rem;
  }

  .catalog-create-card__label {
    font-size: 0.95rem;
  }
}
</style>
