import { loadProjectDraft } from "@/lib/browser-data/indexDB-interface";
import type { ModelCatalog } from "@/features/project-create/three/create3DViewer";
import { LED_OFF_STATE, LED_ON_STATE } from "@/features/project-create/three/stateCodec";

const VALID_STATES = new Set([LED_OFF_STATE, LED_ON_STATE]);

function ensureRecord(value: unknown, path: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${path} must be an object.`);
  }

  return value as Record<string, unknown>;
}

function ensureString(value: unknown, path: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${path} must be a non-empty string.`);
  }

  return value;
}

export function parseModelCatalog(content: string): ModelCatalog {
  if (content.trim().length === 0) {
    throw new Error("Project content is empty. Paste JSON similar to sampledata.json before simulating.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch (error) {
    throw new Error("Project content must be valid JSON before simulation can start.");
  }

  if (!Array.isArray(parsed)) {
    throw new Error("Project content must be an array of model entries.");
  }

  const objectIds = new Set<string>();
  const catalog = parsed.map((entry, entryIndex) => {
    const entryRecord = ensureRecord(entry, `catalog[${entryIndex}]`);
    const modelUrl = ensureString(entryRecord.modelUrl, `catalog[${entryIndex}].modelUrl`);
    const objectsValue = entryRecord.objects;

    if (!Array.isArray(objectsValue) || objectsValue.length === 0) {
      throw new Error(`catalog[${entryIndex}].objects must be a non-empty array.`);
    }

    return {
      modelUrl,
      objects: objectsValue.map((object, objectIndex) => {
        const objectRecord = ensureRecord(
          object,
          `catalog[${entryIndex}].objects[${objectIndex}]`,
        );
        const id = ensureString(
          objectRecord.id,
          `catalog[${entryIndex}].objects[${objectIndex}].id`,
        );

        if (objectIds.has(id)) {
          throw new Error(`Duplicate object id "${id}" was found in project content.`);
        }
        objectIds.add(id);

        const state = ensureString(
          objectRecord.state,
          `catalog[${entryIndex}].objects[${objectIndex}].state`,
        );
        if (!VALID_STATES.has(state)) {
          throw new Error(
            `Unsupported state "${state}" for object "${id}". Expected LED_Off or LED_On.`,
          );
        }

        return {
          id,
          name: ensureString(
            objectRecord.name,
            `catalog[${entryIndex}].objects[${objectIndex}].name`,
          ),
          description: ensureString(
            objectRecord.description,
            `catalog[${entryIndex}].objects[${objectIndex}].description`,
          ),
          state,
        };
      }),
    };
  });

  if (objectIds.size === 0) {
    throw new Error("Project content must include at least one object to simulate.");
  }

  return catalog;
}

export async function loadModelCatalogFromDraft(projectId: string | null): Promise<ModelCatalog> {
  const draft = await loadProjectDraft(projectId);

  if (!draft) {
    throw new Error("No project draft was found in IndexedDB for simulation.");
  }

  return parseModelCatalog(draft.content);
}
