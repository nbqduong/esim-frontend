import { fetchPublicStaticAssets, type StaticAsset } from "./api";
import { resolveModelUrl } from "@/features/project-create/three/loadModel";

export class CatalogManager {
  private staticAssets: StaticAsset[] = [];
  private isLoaded = false;

  /**
   * Initializes the catalog manager by fetching available models from the backend.
   */
  async initialize(): Promise<void> {
    if (this.isLoaded) return;
    
    try {
      this.staticAssets = await fetchPublicStaticAssets();
      this.isLoaded = true;
    } catch (error) {
      console.error("Failed to load static assets catalog", error);
      throw error;
    }
  }

  /**
   * Checks if a model URL exists in the valid public assets list and returns the full CDN URL.
   * If the model doesn't exist, returns null.
   * Extensible for future multi-vendor support.
   */
  getValidModelUrl(url: string): string | null {
    if (!this.isLoaded) {
      console.warn("CatalogManager is not initialized. Call initialize() first.");
    }

    // 1. Find if the URL matches an asset from the backend list
    const asset = this.staticAssets.find(a => a.url === url || `/${a.url}` === url);
    
    // 2. If it exists in the public assets, resolve to the full CDN path
    if (asset) {
      return resolveModelUrl(asset.url);
    }

    // If not found in the backend public assets, return null as per requirement
    // "just load valid urls"
    return null;
  }

  getAvailableAssets(): StaticAsset[] {
    return [...this.staticAssets];
  }
}

// Singleton instance
export const catalogManager = new CatalogManager();
