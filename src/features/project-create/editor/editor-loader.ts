import { requestJson } from "@/lib/outer-data/backend-interface";
import { resolveStaticAssetUrl } from "@/features/static-models/resolveStaticAssetUrl";

export type Editor2DComponentId = string;

export interface Editor2DComponentPinPosition {
  x: number;
  y: number;
}

export interface Editor2DComponentCatalogItem {
  description: string;
  id: Editor2DComponentId;
  permission: "Public" | "Private";
  pinPositions: Editor2DComponentPinPosition[];
  previewUrl: string;
  sourceUrl: string;
  title: string;
}

export interface Editor2DComponentPlacement {
  pinPositions: Editor2DComponentPinPosition[];
  svg: string;
}

interface ElectricComponentApiItem {
  id: string;
  permission: "Public" | "Private";
  pinPositions: Editor2DComponentPinPosition[];
  previewUrl: string;
  sourceUrl: string;
  title: string;
}

const placementCache = new Map<Editor2DComponentId, Promise<Editor2DComponentPlacement>>();

function normalizeComponentId(title: string): Editor2DComponentId {
  return title.trim().toLowerCase().replace(/\s+/g, "-");
}

function buildDescription(componentId: Editor2DComponentId): string {
  switch (componentId) {
    case "resistor":
      return "Two-pin passive sample";
    case "switch":
      return "Open switch sample";
    case "lamp":
      return "Lamp/load sample";
    default:
      return "Two-pin electric component";
  }
}

export async function fetch2DComponentCatalog(): Promise<Editor2DComponentCatalogItem[]> {
  const components = await requestJson<ElectricComponentApiItem[]>(
    "/api/static-assets/electric-components",
  );

  return components.map((component) => {
    const componentId = normalizeComponentId(component.title);

    return {
      description: buildDescription(componentId),
      id: componentId,
      permission: component.permission,
      pinPositions: component.pinPositions.map((pinPosition) => ({ ...pinPosition })),
      previewUrl: resolveStaticAssetUrl(component.previewUrl),
      sourceUrl: resolveStaticAssetUrl(component.sourceUrl),
      title: component.title,
    };
  });
}

export async function load2DComponentPlacement(
  component: Editor2DComponentCatalogItem,
): Promise<Editor2DComponentPlacement> {
  let cachedPlacement = placementCache.get(component.id);

  if (!cachedPlacement) {
    cachedPlacement = fetch(component.sourceUrl)
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`Failed to load ${component.title} asset (${response.status})`);
        }

        return response.text();
      })
      .then((svg) => ({
        pinPositions: component.pinPositions.map((pinPosition) => ({ ...pinPosition })),
        svg,
      }));

    placementCache.set(component.id, cachedPlacement);
  }

  try {
    return await cachedPlacement;
  } catch (error) {
    placementCache.delete(component.id);
    throw error;
  }
}
