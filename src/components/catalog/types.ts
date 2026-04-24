import type { RouteLocationRaw } from "vue-router";

export interface CatalogCardItem {
  id?: string;
  subtitle?: string;
  to?: RouteLocationRaw;
  title: string;
  updatedLabel?: string;
}

export interface CatalogSection {
  title: string;
  items: CatalogCardItem[];
}
