import sampleCatalog from "@/sampledata.json";
import { parseModelCatalog } from "@/data/data-loader";
import { loadProjectDraft } from "@/data/project-loader";

export async function loadModelCatalogFromIndexedDB() {
  const draft = await loadProjectDraft(null);

  if (draft && draft.content.trim().length > 0) {
    return parseModelCatalog(draft.content);
  }

  return parseModelCatalog(JSON.stringify(sampleCatalog));
}
